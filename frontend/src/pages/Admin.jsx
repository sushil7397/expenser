import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  deleteExpense, deleteUser, listUsers,
  setUserAdmin, setUserBalanceOverride, updateExpense, updateUserPassword,
} from "../db.js";
import { useAllExpenses } from "../data.js";

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleString();
}

export default function Admin() {
  const { user } = useAuth();
  const { rows, loading } = useAllExpenses();
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState("expenses");

  async function reloadUsers() { setUsers(await listUsers()); }
  useEffect(() => { reloadUsers(); }, [rows.length]);

  if (user === undefined) return <p className="mt-4">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return (
    <div className="alert alert-warning mt-4">
      Admin access required. You're signed in as <strong>{user.username}</strong>.
    </div>
  );

  return (
    <div className="mt-4">
      <h2 className="mb-3">Admin dashboard</h2>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === "expenses" ? "active" : ""}`}
                  onClick={() => setTab("expenses")}>
            Expenses <span className="badge bg-secondary">{rows.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "users" ? "active" : ""}`}
                  onClick={() => setTab("users")}>
            Users <span className="badge bg-secondary">{users.length}</span>
          </button>
        </li>
      </ul>

      {tab === "expenses" && (
        <AdminExpensesPanel rows={rows} loading={loading} users={users} />
      )}
      {tab === "users" && (
        <AdminUsersPanel users={users} currentUserId={user.id} onReload={reloadUsers} />
      )}
    </div>
  );
}

function AdminExpensesPanel({ rows, loading, users }) {
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const filtered = useMemo(() => rows.filter((r) => {
    if (userFilter && String(r.user_id) !== userFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(r.expense_place || "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, query, userFilter]);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <input className="form-control" placeholder="Search place…"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}{u.is_admin ? " (admin)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="col-md-2 text-end">
          <span className="text-muted">Showing {filtered.length}</span>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Date</th><th>User</th><th>Place</th><th>Type</th>
              <th className="text-end">Amount</th><th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => editingId === r.id ? (
              <EditRow key={r.id} row={r} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.user_username || <em className="text-muted">—</em>}</td>
                <td>{r.expense_place}</td>
                <td>
                  <span className={r.transaction_type === "debit" ? "text-danger" : "text-success"}>
                    {r.transaction_type}
                  </span>
                </td>
                <td className={`text-end ${r.transaction_type === "debit" ? "text-danger" : "text-success"}`}>
                  ₹{r.expense_amount}
                </td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary me-1"
                          onClick={() => setEditingId(r.id)}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger"
                          onClick={async () => {
                            if (confirm(`Delete "${r.expense_place}" (₹${r.expense_amount})?`)) {
                              await deleteExpense(r.id);
                            }
                          }}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted py-4">No matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditRow({ row, onDone }) {
  const [place, setPlace] = useState(row.expense_place);
  const [amount, setAmount] = useState(row.expense_amount);
  const [type, setType] = useState(row.transaction_type);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await updateExpense(row.id, {
      expense_place: place,
      expense_amount: amount,
      transaction_type: type,
    });
    setBusy(false);
    onDone();
  }

  return (
    <tr className="table-warning">
      <td>{new Date(row.date).toLocaleDateString()}</td>
      <td>{row.user_username || "—"}</td>
      <td><input className="form-control form-control-sm" value={place}
                 onChange={(e) => setPlace(e.target.value)} /></td>
      <td>
        <select className="form-select form-select-sm" value={type}
                onChange={(e) => setType(e.target.value)}>
          <option value="debit">debit</option>
          <option value="credit">credit</option>
        </select>
      </td>
      <td><input type="number" step="0.01" className="form-control form-control-sm text-end"
                 value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
      <td className="text-end">
        <button className="btn btn-sm btn-success me-1" onClick={save} disabled={busy}>Save</button>
        <button className="btn btn-sm btn-secondary" onClick={onDone}>Cancel</button>
      </td>
    </tr>
  );
}

function AdminUsersPanel({ users, currentUserId, onReload }) {
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle">
        <thead className="table-light">
          <tr>
            <th>ID</th><th>Username</th><th>Role</th>
            <th>Current balance</th><th>Created</th><th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} u={u} isSelf={u.id === currentUserId} onReload={onReload} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ u, isSelf, onReload }) {
  const [override, setOverride] = useState(u.balance_override ?? "");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function saveOverride() {
    setMsg("");
    try {
      await setUserBalanceOverride(u.id, override === "" ? null : override);
      setMsg("saved");
      onReload();
    } catch (e) { setMsg(e.message); }
  }

  async function savePassword() {
    setMsg("");
    try {
      await updateUserPassword(u.id, pw);
      setPw(""); setMsg("password updated");
    } catch (e) { setMsg(e.message); }
  }

  async function toggleAdmin() {
    await setUserAdmin(u.id, !u.is_admin);
    onReload();
  }

  async function remove() {
    if (!confirm(`Delete user "${u.username}" AND all their expenses?`)) return;
    await deleteUser(u.id);
    onReload();
  }

  return (
    <tr>
      <td>{u.id}</td>
      <td>{u.username}{isSelf && <span className="badge bg-info ms-2">you</span>}</td>
      <td>
        {u.is_admin ? <span className="badge bg-primary">admin</span> : <span className="badge bg-secondary">user</span>}
        {!isSelf && (
          <button className="btn btn-sm btn-link p-0 ms-2" onClick={toggleAdmin}>
            {u.is_admin ? "demote" : "promote"}
          </button>
        )}
      </td>
      <td>
        <div className="input-group input-group-sm">
          <span className="input-group-text">₹</span>
          <input className="form-control" value={override} placeholder="0.00"
                 onChange={(e) => setOverride(e.target.value)} />
          <button className="btn btn-outline-primary" onClick={saveOverride}>save</button>
        </div>
      </td>
      <td><small className="text-muted">{new Date(u.created_at).toLocaleDateString()}</small></td>
      <td className="text-end">
        <div className="input-group input-group-sm mb-1" style={{ maxWidth: 240 }}>
          <input className="form-control" type="password" placeholder="new password"
                 value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn btn-outline-primary" onClick={savePassword} disabled={!pw}>set</button>
        </div>
        {!isSelf && (
          <button className="btn btn-sm btn-outline-danger" onClick={remove}>delete user</button>
        )}
        {msg && <div className="small text-success mt-1">{msg}</div>}
      </td>
    </tr>
  );
}
