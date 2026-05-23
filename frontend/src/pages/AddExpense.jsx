import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addExpense } from "../data.js";
import { useAuth } from "../auth.jsx";

export default function AddExpense() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("debit");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const a = parseFloat(amount);
    if (!place.trim()) { setErr("Place is required."); return; }
    if (!isFinite(a) || a <= 0) { setErr("Amount must be a positive number."); return; }
    setBusy(true);
    try {
      await addExpense({
        user_id: user.id,
        expense_place: place,
        expense_amount: a,
        transaction_type: type,
      });
      navigate("/");
    } catch (ex) {
      setErr(ex.message || "Save failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-4">
      <div className="row justify-content-center">
        <div className="col-md-7 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h4 className="mb-0">Add new expense</h4>
            </div>
            <div className="card-body p-4">
              <form onSubmit={onSubmit}>
                <div className="mb-3">
                  <label className="form-label">Place</label>
                  <input className="form-control form-control-lg" placeholder="Where was this?"
                         value={place} onChange={(e) => setPlace(e.target.value)} autoFocus />
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-5">
                    <label className="form-label">Type</label>
                    <select className="form-select form-select-lg" value={type}
                            onChange={(e) => setType(e.target.value)}>
                      <option value="debit">Debit (−)</option>
                      <option value="credit">Credit (+)</option>
                    </select>
                  </div>
                  <div className="col-md-7">
                    <label className="form-label">Amount</label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text">₹</span>
                      <input className="form-control" type="number" step="0.01"
                             placeholder="0.00" value={amount}
                             onChange={(e) => setAmount(e.target.value)} />
                    </div>
                  </div>
                </div>
                {err && <div className="alert alert-danger py-2">{err}</div>}
                <div className="d-flex justify-content-between mt-4">
                  <Link to="/" className="btn btn-outline-secondary">Cancel</Link>
                  <button className="btn btn-success btn-lg" disabled={busy}>
                    {busy ? "Saving…" : "Save expense"}
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
