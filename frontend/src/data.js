// React-side hooks over db.js. Subscribes to mutations so components re-render
// after add/edit/delete or auth changes.

import { useEffect, useMemo, useState } from "react";
import { listExpenses, subscribe } from "./db.js";
import { useAuth } from "./auth.jsx";

export {
  addExpense, updateExpense, deleteExpense,
  listUsers, getUser, updateUserPassword, setUserAdmin, setUserBalanceOverride, deleteUser,
  clearLocalDB, ready,
} from "./db.js";

// Expenses for the currently logged-in user.
export function useExpenses() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) { if (!cancelled) setRows([]); return; }
      try {
        const r = await listExpenses({ userId: user.id });
        if (!cancelled) setRows(r);
      } catch (e) { if (!cancelled) setError(e); }
    }
    load();
    return subscribe(load);
  }, [user?.id]);

  const balance = useMemo(() => {
    if (!rows || !user) return 0;
    const override = user.balance_override != null ? parseFloat(user.balance_override) : 0;
    return rows.reduce((sum, e) => {
      const a = parseFloat(e.expense_amount) || 0;
      return e.transaction_type === "credit" ? sum + a : sum - a;
    }, override);
  }, [rows, user]);

  return { rows: rows ?? [], balance, loading: rows === null, error };
}

// All expenses across all users — admin only.
export function useAllExpenses() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await listExpenses({ all: true });
      if (!cancelled) setRows(r);
    }
    load();
    return subscribe(load);
  }, []);
  return { rows: rows ?? [], loading: rows === null };
}
