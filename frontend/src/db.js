// In-browser SQLite store, backed by sql.js (WebAssembly SQLite).
//
// Lifecycle:
//   1. On first load, fetch the bundled db.sqlite3 (~76 KB).
//   2. Load it into an in-memory sql.js instance.
//   3. After every mutation, export the DB bytes and stash them in IndexedDB.
//   4. On subsequent loads, prefer the IndexedDB copy so your edits survive.
//
// Reset the local copy via clearLocalDB() — the next reload re-seeds from the
// bundled file.

import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const IDB_NAME = "expenser";
const IDB_STORE = "kv";
const IDB_KEY = "db_blob_v1";

// --- IndexedDB key-value helpers (no third-party lib, just enough for one key)

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- sql.js singleton

let SQL = null;
let dbInstance = null;
let initPromise = null;
const listeners = new Set();

function notify() { listeners.forEach((fn) => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function loadBundledDB() {
  const res = await fetch(`${import.meta.env.BASE_URL}db.sqlite3`);
  if (!res.ok) throw new Error(`Failed to fetch db.sqlite3: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function bootstrap() {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const stored = await idbGet(IDB_KEY);
  const bytes = stored ? new Uint8Array(stored) : await loadBundledDB();
  dbInstance = new SQL.Database(bytes);
  // First-run: persist the seeded DB so we don't refetch on every reload.
  if (!stored) await persist();
}

async function persist() {
  const bytes = dbInstance.export();
  // Store as ArrayBuffer for compatibility across browsers.
  await idbSet(IDB_KEY, bytes.buffer);
}

export function ready() {
  if (!initPromise) initPromise = bootstrap();
  return initPromise;
}

// --- query helpers

function rowsFrom(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

export async function listExpenses() {
  await ready();
  return rowsFrom(dbInstance.exec("SELECT * FROM expenses ORDER BY date DESC"));
}

export async function addExpense({ expense_place, expense_amount, transaction_type }) {
  await ready();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const date = new Date().toISOString();
  const amount = Number(expense_amount).toFixed(2);
  dbInstance.run(
    `INSERT INTO expenses (id, date, expense_place, expense_amount, transaction_type)
     VALUES (?, ?, ?, ?, ?)`,
    [id, date, String(expense_place).trim(), amount, transaction_type]
  );
  await persist();
  notify();
}

export async function deleteExpense(id) {
  await ready();
  dbInstance.run("DELETE FROM expenses WHERE id = ?", [id]);
  await persist();
  notify();
}

export async function clearLocalDB() {
  await idbDelete(IDB_KEY);
  initPromise = null;
  dbInstance = null;
  await ready();
  notify();
}
