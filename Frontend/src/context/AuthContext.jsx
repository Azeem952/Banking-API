import { createContext, useContext, useState, useCallback } from "react";
import {
  loginUser,
  registerUser,
  logoutUser,
  getCurrentSession,
} from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getCurrentSession());

  const refresh = useCallback(() => {
    setSession(getCurrentSession());
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await loginUser(credentials);
    setSession({
      user: result.user,
      onboarding: result.onboarding,
      account: result.account,
    });
    return result;
  }, []);

  const register = useCallback(async (payload) => {
    return registerUser(payload);
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setSession(null);
  }, []);

  const value = {
    session,
    isAuthenticated: Boolean(session?.user),
    user: session?.user || null,
    onboarding: session?.onboarding || null,
    account: session?.account || null,
    login,
    register,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
