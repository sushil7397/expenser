import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, login as dbLogin, logout as dbLogout, signup as dbSignup, subscribe } from "./db.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);   // undefined = still loading

  async function refresh() {
    setUser(await getCurrentUser());
  }

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, []);

  return (
    <AuthCtx.Provider value={{
      user,
      loading: user === undefined,
      login: async (creds) => { await dbLogin(creds); await refresh(); },
      signup: async (creds) => { await dbSignup(creds); await refresh(); },
      logout: () => { dbLogout(); refresh(); },
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
