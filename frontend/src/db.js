// In-browser SQLite store, backed by sql.js (WebAssembly SQLite).
//
// Schema:
//   users     (id, username, password_hash, salt, is_admin, created_at)
//   expenses  (id, user_id, date, expense_place, expense_amount, transaction_type)
//
// Auth model (HONEST):
//   Password hashing uses PBKDF2-SHA256 (Web Crypto). That's the right primitive,
//   but everything runs in the browser. A determined user with DevTools can
//   reset the IndexedDB blob, swap their own user record into admin, or bypass
//   the route guards entirely. Use this as a UI gate, not real security.
//
// Lifecycle:
//   - On first load, fetch the bundled db.sqlite3 (~76 KB).
//   - Migrate: add users table + user_id column if missing.
//   - On every mutation, export and stash in IndexedDB.

import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const IDB_NAME = "expenser";
const IDB_STORE = "kv";
const IDB_KEY = "db_blob_v4";   // bump if you ever do an incompatible schema change

const CURRENT_USER_KEY = "expenser_current_user_v1";

// ---------- IndexedDB helpers (single-key kv) ----------

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

// ---------- Password hashing (Web Crypto, PBKDF2 100k iterations) ----------

const ITERATIONS = 100_000;
const SALT_BYTES = 16;

function buf2b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b642buf(b64) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function pbkdf2(password, saltB64) {
  const salt = b642buf(saltB64);
  const baseKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    256
  );
  return buf2b64(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const saltB64 = buf2b64(salt.buffer);
  const hash = await pbkdf2(password, saltB64);
  return { hash, salt: saltB64 };
}

async function verifyPassword(password, hash, saltB64) {
  return (await pbkdf2(password, saltB64)) === hash;
}

// ---------- sql.js singleton ----------

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

function migrate() {
  // Add the users table if missing.
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      balance_override TEXT,
      created_at TEXT NOT NULL
    )
  `);
  // Add user_id column to expenses if missing.
  const cols = dbInstance.exec("PRAGMA table_info(expenses)")[0]?.values?.map((r) => r[1]) || [];
  if (!cols.includes("user_id")) {
    dbInstance.run("ALTER TABLE expenses ADD COLUMN user_id INTEGER");
  }
}

async function bootstrap() {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const stored = await idbGet(IDB_KEY);
  const bytes = stored ? new Uint8Array(stored) : await loadBundledDB();
  dbInstance = new SQL.Database(bytes);
  migrate();
  if (!stored) await persist();
}

async function persist() {
  const bytes = dbInstance.export();
  await idbSet(IDB_KEY, bytes.buffer);
}

export function ready() {
  if (!initPromise) initPromise = bootstrap();
  return initPromise;
}

function rowsFrom(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// ---------- Users / auth ----------

export async function userCount() {
  await ready();
  return rowsFrom(dbInstance.exec("SELECT COUNT(*) AS n FROM users"))[0]?.n ?? 0;
}

export async function listUsers() {
  await ready();
  return rowsFrom(dbInstance.exec(
    "SELECT id, username, is_admin, balance_override, created_at FROM users ORDER BY id"
  ));
}

export async function getUser(id) {
  await ready();
  return rowsFrom(dbInstance.exec(
    "SELECT id, username, is_admin, balance_override, created_at FROM users WHERE id = ?",
    [id],
  ))[0] || null;
}

export async function signup({ username, password }) {
  await ready();
  username = String(username).trim();
  if (!username) throw new Error("Username is required.");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
  if (rowsFrom(dbInstance.exec("SELECT 1 FROM users WHERE username = ?", [username])).length) {
    throw new Error("That username is already taken.");
  }
  const { hash, salt } = await hashPassword(password);
  // First signup becomes admin and claims all pre-seeded (user_id IS NULL) expenses.
  const isFirstUser = (await userCount()) === 0;
  dbInstance.run(
    `INSERT INTO users (username, password_hash, salt, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [username, hash, salt, isFirstUser ? 1 : 0, new Date().toISOString()]
  );
  const newId = rowsFrom(dbInstance.exec("SELECT last_insert_rowid() AS id"))[0].id;
  if (isFirstUser) {
    dbInstance.run("UPDATE expenses SET user_id = ? WHERE user_id IS NULL", [newId]);
  }
  await persist();
  notify();
  setCurrentUserId(newId);
  return await getUser(newId);
}

export async function login({ username, password }) {
  await ready();
  const row = rowsFrom(dbInstance.exec(
    "SELECT id, password_hash, salt FROM users WHERE username = ?",
    [String(username).trim()],
  ))[0];
  if (!row) throw new Error("Invalid username or password.");
  if (!(await verifyPassword(password, row.password_hash, row.salt))) {
    throw new Error("Invalid username or password.");
  }
  setCurrentUserId(row.id);
  notify();
  return await getUser(row.id);
}

export function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
  notify();
}

function setCurrentUserId(id) {
  localStorage.setItem(CURRENT_USER_KEY, String(id));
}

export function getCurrentUserId() {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  return raw ? Number(raw) : null;
}

export async function getCurrentUser() {
  const id = getCurrentUserId();
  if (!id) return null;
  const user = await getUser(id);
  if (!user) {
    // The stored ID points at a user that no longer exists.
    logout();
    return null;
  }
  return user;
}

// ---------- Admin: edit users ----------

export async function updateUserPassword(userId, newPassword) {
  await ready();
  if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
  const { hash, salt } = await hashPassword(newPassword);
  dbInstance.run("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", [hash, salt, userId]);
  await persist();
  notify();
}

export async function setUserAdmin(userId, isAdmin) {
  await ready();
  dbInstance.run("UPDATE users SET is_admin = ? WHERE id = ?", [isAdmin ? 1 : 0, userId]);
  await persist();
  notify();
}

export async function setUserBalanceOverride(userId, override) {
  await ready();
  // null/empty = unset; otherwise stored as the user's effective starting balance.
  const value = override === "" || override == null ? null : String(Number(override).toFixed(2));
  dbInstance.run("UPDATE users SET balance_override = ? WHERE id = ?", [value, userId]);
  await persist();
  notify();
}

export async function deleteUser(userId) {
  await ready();
  // Cascade: delete that user's expenses too.
  dbInstance.run("DELETE FROM expenses WHERE user_id = ?", [userId]);
  dbInstance.run("DELETE FROM users WHERE id = ?", [userId]);
  await persist();
  if (getCurrentUserId() === userId) logout();
  notify();
}

// ---------- Expenses ----------

export async function listExpenses({ userId, all = false } = {}) {
  await ready();
  if (all) {
    return rowsFrom(dbInstance.exec(`
      SELECT e.*, u.username AS user_username
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.date DESC
    `));
  }
  return rowsFrom(dbInstance.exec(
    "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC",
    [userId],
  ));
}

export async function addExpense({ user_id, expense_place, expense_amount, transaction_type }) {
  await ready();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const date = new Date().toISOString();
  const amount = Number(expense_amount).toFixed(2);
  dbInstance.run(
    `INSERT INTO expenses (id, user_id, date, expense_place, expense_amount, transaction_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, user_id, date, String(expense_place).trim(), amount, transaction_type]
  );
  await persist();
  notify();
}

// Admin-only.
export async function updateExpense(id, { expense_place, expense_amount, transaction_type }) {
  await ready();
  dbInstance.run(
    `UPDATE expenses
       SET expense_place = ?, expense_amount = ?, transaction_type = ?
     WHERE id = ?`,
    [
      String(expense_place).trim(),
      Number(expense_amount).toFixed(2),
      transaction_type,
      id,
    ],
  );
  await persist();
  notify();
}

// Admin-only.
export async function deleteExpense(id) {
  await ready();
  dbInstance.run("DELETE FROM expenses WHERE id = ?", [id]);
  await persist();
  notify();
}

// ---------- Factory reset (debugging) ----------

export async function clearLocalDB() {
  await idbDelete(IDB_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
  initPromise = null;
  dbInstance = null;
  await ready();
  notify();
}
