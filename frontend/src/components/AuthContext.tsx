import { createContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getMe } from "../api/auth";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
  refreshUser: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  setToken: () => {},
  logout: () => {},
  refreshUser: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((t: string) => {
    localStorage.setItem("token", t);
    setLoading(true); // keep ProtectedRoute in loading state until getMe() resolves
    setTokenState(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => {
    getMe().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    window.addEventListener("password-change-required", refreshUser);
    return () => window.removeEventListener("password-change-required", refreshUser);
  }, [refreshUser]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ user, token, setToken, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
