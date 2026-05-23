import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useExpenses } from "../data.js";

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString();
}

export default function Expenses() {
  const { rows, balance, loading, error } = useExpenses();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((e) => {
      if (!start && !end) {
        const d = new Date(e.date);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }
      const d = new Date(e.date);
      if (start && d < new Date(start + "T00:00:00")) return false;
      if (end && d > new Date(end + "T23:59:59")) return false;
      return true;
    });
  }, [rows, start, end]);

  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    for (const r of filtered) {
      const a = parseFloat(r.expense_amount) || 0;
      if (r.transaction_type === "debit") debit += a; else credit += a;
    }
    return { debit, credit, net: credit - debit };
  }, [filtered]);

  function onClear() { setStart(""); setEnd(""); }

  if (error) return <div className="alert alert-danger mt-4">Failed to load: {error.message}</div>;
  if (loading) return <p className="mt-4">Loading…</p>;

  return (
    <div className="mt-4">
      <div className="row g-3 mb-4">
        <StatCard label="Current balance" value={balance} tone={balance >= 0 ? "good" : "bad"} />
        <StatCard label="Period credits" value={totals.credit} tone="good" />
        <StatCard label="Period debits" value={totals.debit} tone="bad" />
        <StatCard label="Period net" value={totals.net} tone={totals.net >= 0 ? "good" : "bad"} />
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">Expenses</h5>
            <small className="text-muted">
              {start || end ? "Filtered" : "Current month"} • {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </small>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <Link to="/add" className="btn btn-primary btn-sm">+ Add expense</Link>
            <Link to="/analytics" className="btn btn-outline-primary btn-sm">Analytics</Link>
            <div className="input-group input-group-sm" style={{ width: 320 }}>
              <input type="date" className="form-control" value={start}
                     onChange={(e) => setStart(e.target.value)} />
              <span className="input-group-text">to</span>
              <input type="date" className="form-control" value={end}
                     onChange={(e) => setEnd(e.target.value)} />
              {(start || end) && (
                <button className="btn btn-outline-secondary" onClick={onClear}>×</button>
              )}
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {filtered.length === 0 ? (
            <p className="text-muted text-center py-5 mb-0">No expenses for this period.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Date</th><th>Place</th><th>Type</th>
                    <th className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const debit = r.transaction_type === "debit";
                    const cls = debit ? "text-danger" : "text-success";
                    const sign = debit ? "-" : "+";
                    return (
                      <tr key={r.id}>
                        <td>{fmtDate(r.date)}</td>
                        <td>{r.expense_place}</td>
                        <td>
                          <span className={`badge ${debit ? "bg-danger-subtle text-danger" : "bg-success-subtle text-success"}`}>
                            {debit ? "Debit" : "Credit"}
                          </span>
                        </td>
                        <td className={`text-end fw-medium ${cls}`}>{sign}₹{r.expense_amount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "";
  return (
    <div className="col-md-3 col-6">
      <div className="card shadow-sm h-100">
        <div className="card-body">
          <div className="text-muted small text-uppercase mb-1">{label}</div>
          <div className={`fs-4 fw-semibold ${cls}`}>₹{(value || 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
