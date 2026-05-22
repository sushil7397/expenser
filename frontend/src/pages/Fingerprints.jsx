import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { registerFingerprint } from "../webauthn.js";

function fmt(dt) {
  return dt ? new Date(dt).toLocaleString() : <span className="text-muted">never</span>;
}

export default function Fingerprints() {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api("/webauthn/credentials/");
    setList(r);
  }
  useEffect(() => { load().catch((e) => setMsg({ kind: "danger", text: e.message })); }, []);

  async function onRegister() {
    const label = prompt('Name this device (e.g. "Work laptop", "iPhone"):', "Fingerprint");
    if (label === null) return;
    setBusy(true);
    setMsg({ kind: "info", text: "Touch your fingerprint sensor to register…" });
    try {
      const r = await registerFingerprint({ label });
      setMsg({ kind: "success", text: `Registered "${r.label}".` });
      await load();
    } catch (e) {
      setMsg({ kind: "danger", text: e.message || "Registration failed." });
    } finally { setBusy(false); }
  }

  async function onDelete(id) {
    if (!confirm("Remove this device? You'll need your password to sign in from it again.")) return;
    try {
      await api(`/webauthn/credentials/${id}/`, { method: "DELETE" });
      await load();
    } catch (e) {
      setMsg({ kind: "danger", text: e.message });
    }
  }

  return (
    <div className="mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="mb-0">Fingerprint &amp; security keys</h3>
              <Link to="/" className="btn btn-sm btn-outline-secondary">Back</Link>
            </div>
            <div className="card-body">
              <p className="text-muted">
                Each entry below is one device that can sign you in without your password.
                Add this device, your phone, or a hardware key. Remove any you no longer trust.
              </p>

              <div className="d-grid mb-3">
                <button className="btn btn-success" onClick={onRegister} disabled={busy}>
                  🔒 Register fingerprint on this device
                </button>
              </div>

              {msg.text && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}

              {list.length === 0 ? (
                <p className="text-muted"><em>No fingerprints registered yet.</em></p>
              ) : (
                <table className="table table-sm align-middle">
                  <thead>
                    <tr><th>Label</th><th>Registered</th><th>Last used</th><th /></tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id}>
                        <td>{c.label}</td>
                        <td>{fmt(c.created_at)}</td>
                        <td>{fmt(c.last_used_at)}</td>
                        <td>
                          <button className="btn btn-sm btn-outline-danger"
                                  onClick={() => onDelete(c.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
