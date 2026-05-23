import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { userCount } from "./db.js";
import Layout from "./components/Layout.jsx";
import Expenses from "./pages/Expenses.jsx";
import AddExpense from "./pages/AddExpense.jsx";
import Analytics from "./pages/Analytics.jsx";
import Admin from "./pages/Admin.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const [count, setCount] = useState(null);
  useEffect(() => { userCount().then(setCount); }, []);

  if (loading || count === null) {
    return <div className="container mt-5 text-center text-muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to={count === 0 ? "/signup" : "/login"} replace />;
  }
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Expenses />} />
        <Route path="add" element={<AddExpense />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
