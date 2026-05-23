import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await login({ username, password });
      navigate("/", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Login failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card shadow">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="auth-logo">₹</div>
            <h2 className="mt-3 mb-1">Welcome back</h2>
            <p className="text-muted mb-0">Sign in to your expense tracker</p>
          </div>
          <form onSubmit={onSubmit}>
            <div className="alert alert-info py-2 mb-3 small">
              <strong>First time?</strong> Default admin is <code>sushil</code> / <code>changeme123</code>.
              Change it from the Admin tab right after logging in.
            </div>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input className="form-control form-control-lg" value={username} autoFocus
                     onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input type="password" className="form-control form-control-lg" value={password}
                     onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <div className="alert alert-danger py-2">{err}</div>}
            <div className="d-grid">
              <button className="btn btn-primary btn-lg" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>
          <p className="text-center text-muted mt-4 mb-0">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </div>
      <p className="auth-disclaimer">
        Note: this app stores everything in your browser. Sign-in is a local PIN,
        not server-side authentication.
      </p>
    </div>
  );
}
