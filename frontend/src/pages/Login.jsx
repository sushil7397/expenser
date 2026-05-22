import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { signInWithFingerprint } from "../webauthn.js";

export default function Login() {
  const { user, loginWithPassword, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fpMsg, setFpMsg] = useState({ kind: "", text: "" });

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await loginWithPassword(username.trim(), password);
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e.message || "Login failed.");
    } finally { setBusy(false); }
  }

  async function onFingerprint() {
    setFpMsg({ kind: "", text: "" });
    if (!username.trim()) {
      setFpMsg({ kind: "warning", text: "Type your username first, then tap fingerprint." });
      return;
    }
    setBusy(true);
    setFpMsg({ kind: "info", text: "Touch your fingerprint sensor…" });
    try {
      const r = await signInWithFingerprint(username.trim());
      await loginWithToken(r.token);
      navigate("/", { replace: true });
    } catch (e) {
      setFpMsg({ kind: "danger", text: e.message || "Fingerprint sign-in failed." });
    } finally { setBusy(false); }
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header"><h2 className="text-center mb-0">Sign in</h2></div>
            <div className="card-body">
              <form onSubmit={onSubmit}>
                <div className="mb-3">
                  <label className="form-label">Username</label>
                  <input className="form-control" value={username}
                         onChange={(e) => setUsername(e.target.value)} autoFocus />
                </div>
                <div className="mb-3">
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" value={password}
                         onChange={(e) => setPassword(e.target.value)} />
                </div>
                {err && <div className="alert alert-danger">{err}</div>}
                <div className="d-grid gap-2">
                  <button className="btn btn-primary" disabled={busy}>
                    {busy ? "…" : "Sign in with password"}
                  </button>
                </div>
              </form>

              <hr />

              <div className="d-grid gap-2">
                <button type="button" className="btn btn-outline-success"
                        onClick={onFingerprint} disabled={busy}>
                  🔒 Sign in with fingerprint
                </button>
                <small className="text-muted text-center">
                  Uses Touch&nbsp;ID / Windows&nbsp;Hello / Android fingerprint.
                  Register one after first sign-in.
                </small>
              </div>

              {fpMsg.text && (
                <div className={`alert alert-${fpMsg.kind} mt-3 fp-status`}>{fpMsg.text}</div>
              )}
            </div>
            <div className="card-footer text-center">
              <small>Contact admin for an account</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
