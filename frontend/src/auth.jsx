import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, if a token is in localStorage, fetch /me to confirm it
  // still works and to populate the user record.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getToken()) { setLoading(false); return; }
      try {
        const me = await api("/auth/me/");
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) { setToken(null); setUser(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  async function loginWithPassword(username, password) {
    const r = await api("/auth/login/", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    setToken(r.token);
    const me = await api("/auth/me/");
    setUser(me);
  }

  async function loginWithToken(token) {
    setToken(token);
    const me = await api("/auth/me/");
    setUser(me);
  }

  async function logout() {
    try { await api("/auth/logout/", { method: "POST" }); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }

  async function refreshMe() {
    const me = await api("/auth/me/");
    setUser(me);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, loginWithPassword, loginWithToken, logout, refreshMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
