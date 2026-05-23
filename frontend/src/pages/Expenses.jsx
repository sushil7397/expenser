import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deleteExpense, useExpenses } from "../data.js";

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString();
}

export default function Expenses() {
  const { rows, loading, error } = useExpenses();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((e) => {
      if (!start && !end) {
        // Default: current calendar month
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

  function onClear() { setStart(""); setEnd(""); }

  async function onDelete(id) {
    if (!confirm("Remove this expense?")) return;
    await deleteExpense(id);
  }

  if (error) return <div className="alert alert-danger mt-4">Failed to load: {error.message}</div>;
  if (loading) return <p className="mt-4">Loading database…</p>;

  return (
    <div className="mt-4">
      <h2>Your Expenses</h2>
      <div className="row mb-3">
        <div className="col-md-6">
          <Link to="/add" className="btn btn-primary me-2">Add New Expense</Link>
          <Link to="/analytics" className="btn btn-primary">See Analytics</Link>
        </div>
        <div className="col-md-6">
          <div className="input-group">
            <input type="date" className="form-control" value={start}
                   onChange={(e) => setStart(e.target.value)} />
            <span className="input-group-text">to</span>
            <input type="date" className="form-control" value={end}
                   onChange={(e) => setEnd(e.target.value)} />
            {(start || end) && (
              <button className="btn btn-outline-danger" onClick={onClear}>Clear</button>
            )}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p>No expenses found for the selected criteria.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Date</th><th>Place</th><th>Type</th>
              <th className="text-end">Amount</th><th />
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
                  <td><span className={cls}>{debit ? "Debit (-)" : "Credit (+)"}</span></td>
                  <td className={`text-end ${cls}`}>{sign}₹{r.expense_amount}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary"
                            onClick={() => onDelete(r.id)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
