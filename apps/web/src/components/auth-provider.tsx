"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CurrentUser } from "@cognelo/contracts";
import { api, API_UNAUTHORIZED_EVENT } from "@/lib/api";

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  activateAccount: (input: { email: string; password: string; confirmPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const result = await api.me();
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setLoading(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    function handleFocus() {
      void refresh();
    }

    window.addEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener(API_UNAUTHORIZED_EVENT, handleUnauthorized);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      login: async (email, password) => {
        const result = await api.login(email, password);
        setUser(result.user);
      },
      activateAccount: async (input) => {
        const result = await api.activateAccount(input);
        setUser(result.user);
      },
      logout: async () => {
        await api.logout();
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
