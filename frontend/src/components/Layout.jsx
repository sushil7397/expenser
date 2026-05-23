import { Link, NavLink, Outlet } from "react-router-dom";
import { useExpenses } from "../data.js";

export default function Layout() {
  const { balance, loading } = useExpenses();
  const balCls = balance >= 0 ? "balance-positive" : "balance-negative";

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <Link className="navbar-brand" to="/">Expense Tracker</Link>
          <ul className="navbar-nav ms-auto d-flex flex-row gap-3 align-items-center">
            <li className="nav-item"><NavLink className="nav-link" to="/" end>Expenses</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/add">Add</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/analytics">Analytics</NavLink></li>
            <li className="nav-item">
              {loading
                ? <span className="nav-link text-muted">Loading…</span>
                : <span className={`nav-link ${balCls}`}>Balance: ₹{balance.toFixed(2)}</span>}
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
