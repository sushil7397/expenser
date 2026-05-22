import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const bal = parseFloat(user?.balance || "0");
  const balCls = bal >= 0 ? "balance-positive" : "balance-negative";

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <Link className="navbar-brand" to="/">Expense Tracker</Link>
          <ul className="navbar-nav ms-auto d-flex flex-row gap-3 align-items-center">
            <li className="nav-item"><NavLink className="nav-link" to="/">Expenses</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/add">Add</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/analytics">Analytics</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/fingerprints">🔒 Fingerprint</NavLink></li>
            <li className="nav-item">
              <span className={`nav-link ${balCls}`}>Balance: ₹{user?.balance}</span>
            </li>
            <li className="nav-item">
              <span className="nav-link">Hi, {user?.username}</span>
            </li>
            <li className="nav-item">
              <button onClick={onLogout} className="btn btn-sm btn-outline-light">Logout</button>
            </li>
          </ul>
        </div>
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
