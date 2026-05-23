import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-semibold" to="/">
            <span className="brand-mark">₹</span> Expenser
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse"
                  data-bs-target="#navMain">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navMain">
            <ul className="navbar-nav me-auto">
              <li className="nav-item"><NavLink className="nav-link" to="/" end>Dashboard</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/add">Add</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/analytics">Analytics</NavLink></li>
              {user?.is_admin && (
                <li className="nav-item"><NavLink className="nav-link" to="/admin">Admin</NavLink></li>
              )}
            </ul>
            <ul className="navbar-nav align-items-lg-center gap-lg-2">
              <li className="nav-item">
                <span className="nav-link">
                  {user?.username}
                  {user?.is_admin && <span className="badge bg-primary ms-2">admin</span>}
                </span>
              </li>
              <li className="nav-item">
                <button onClick={onLogout} className="btn btn-sm btn-outline-light">Sign out</button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      <main className="container pb-5">
        <Outlet />
      </main>
    </div>
  );
}
