import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function AddExpense() {
  const { refreshMe } = useAuth();
  const navigate = useNavigate();
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("debit");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await api("/expenses/", {
        method: "POST",
        body: {
          expense_place: place.trim(),
          expense_amount: amount,
          transaction_type: type,
        },
      });
      await refreshMe(); // balance changed
      navigate("/");
    } catch (ex) {
      setErr(ex.message || "Save failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h3 className="mb-0">Add New Expense</h3>
            </div>
            <div className="card-body">
              <form onSubmit={onSubmit}>
                <div className="mb-3">
                  <label className="form-label">Place</label>
                  <input className="form-control" placeholder="Enter location"
                         value={place} onChange={(e) => setPlace(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Transaction Details</label>
                  <div className="row">
                    <div className="col-md-4">
                      <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="debit">Debit (-)</option>
                        <option value="credit">Credit (+)</option>
                      </select>
                    </div>
                    <div className="col-md-8">
                      <div className="input-group">
                        <span className="input-group-text">₹</span>
                        <input className="form-control" type="number" step="0.01"
                               placeholder="0.00" value={amount}
                               onChange={(e) => setAmount(e.target.value)} required />
                      </div>
                    </div>
                  </div>
                </div>
                {err && <div className="alert alert-danger">{err}</div>}
                <div className="mt-4 d-flex justify-content-between">
                  <Link to="/" className="btn btn-secondary">Cancel</Link>
                  <button className="btn btn-success" disabled={busy}>
                    {busy ? "Saving…" : "Save Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
