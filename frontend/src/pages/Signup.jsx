import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { userCount } from "../db.js";

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isFirst, setIsFirst] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { userCount().then((n) => setIsFirst(n === 0)); }, []);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      await signup({ username, password });
      navigate("/", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Signup failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card shadow">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="auth-logo">₹</div>
            <h2 className="mt-3 mb-1">Create account</h2>
            <p className="text-muted mb-0">Start tracking your expenses</p>
          </div>
          {isFirst && (
            <div className="alert alert-info py-2">
              <strong>First user</strong> — you'll be the admin of this browser's data.
              Existing seeded expenses (if any) will be assigned to you.
            </div>
          )}
          <form onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input className="form-control form-control-lg" value={username} autoFocus
                     onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input type="password" className="form-control form-control-lg" value={password}
                     onChange={(e) => setPassword(e.target.value)} />
              <div className="form-text">Minimum 6 characters.</div>
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm password</label>
              <input type="password" className="form-control form-control-lg" value={confirm}
                     onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {err && <div className="alert alert-danger py-2">{err}</div>}
            <div className="d-grid">
              <button className="btn btn-primary btn-lg" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
          <p className="text-center text-muted mt-4 mb-0">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
      <p className="auth-disclaimer">
        Note: data lives in this browser only. Clearing site data wipes all accounts and expenses.
      </p>
    </div>
  );
}
