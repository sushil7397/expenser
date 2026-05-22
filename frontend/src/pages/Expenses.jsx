import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function Expenses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  async function load(s = start, e = end) {
    setLoading(true); setErr("");
    try {
      const params = new URLSearchParams();
      if (s) params.set("start_date", s);
      if (e) params.set("end_date", e);
      const qs = params.toString() ? `?${params}` : "";
      const data = await api(`/expenses/${qs}`);
      setRows(Array.isArray(data) ? data : data.results || []);
    } catch (ex) {
      setErr(ex.message || "Failed to load expenses.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function onFilter(e) {
    e.preventDefault();
    load();
  }
  function onClear() {
    setStart(""); setEnd("");
    load("", "");
  }

  return (
    <div className="mt-4">
      <h2>Your Expenses</h2>
      <div className="row mb-3">
        <div className="col-md-6">
          <Link to="/add" className="btn btn-primary me-2">Add New Expense</Link>
          <Link to="/analytics" className="btn btn-primary">See Analytics</Link>
        </div>
        <div className="col-md-6">
          <form onSubmit={onFilter} className="d-flex">
            <div className="input-group">
              <input type="date" className="form-control" value={start}
                     onChange={(e) => setStart(e.target.value)} />
              <span className="input-group-text">to</span>
              <input type="date" className="form-control" value={end}
                     onChange={(e) => setEnd(e.target.value)} />
              <button className="btn btn-outline-secondary">Filter</button>
              {(start || end) && (
                <button type="button" className="btn btn-outline-danger" onClick={onClear}>Clear</button>
              )}
            </div>
          </form>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No expenses found for the selected criteria.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr><th>Date</th><th>Place</th><th>Type</th><th className="text-end">Amount</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isDebit = r.transaction_type === "debit";
              const cls = isDebit ? "text-danger" : "text-success";
              const sign = isDebit ? "-" : "+";
              return (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.expense_place}</td>
                  <td><span className={cls}>{isDebit ? "Debit (-)" : "Credit (+)"}</span></td>
                  <td className={`text-end ${cls}`}>{sign}₹{r.expense_amount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
