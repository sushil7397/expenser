// React-side wrapper around db.js. Subscribes to DB mutations so components
// re-render after add/delete.

import { useEffect, useMemo, useState } from "react";
import { listExpenses, subscribe } from "./db.js";

export { addExpense, deleteExpense, clearLocalDB, ready } from "./db.js";

export function useExpenses() {
  const [rows, setRows] = useState(null);   // null = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await listExpenses();
        if (!cancelled) setRows(r);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    }
    load();
    return subscribe(load);
  }, []);

  const balance = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((sum, e) => {
      const a = parseFloat(e.expense_amount) || 0;
      return e.transaction_type === "credit" ? sum + a : sum - a;
    }, 0);
  }, [rows]);

  return { rows, balance, loading: rows === null, error };
}
