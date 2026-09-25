"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CurrentUser } from "@cognelo/contracts";
import { api, API_UNAUTHORIZED_EVENT } from "@/lib/api";
import { createSessionRefresher } from "@/lib/session-refresh";

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  sessionUnavailable: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  activateAccount: (input: { email: string; password: string; confirmPassword: string }) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const refresherRef = useRef<ReturnType<typeof createSessionRefresher<{ user: CurrentUser }>> | null>(null);

  if (!refresherRef.current) {
    refresherRef.current = createSessionRefresher({
      check: api.me,
      onAuthenticated: (result) => {
        setUser(result.user);
        setSessionUnavailable(false);
        setLoading(false);
      },
      onUnauthorized: () => {
        setUser(null);
        setSessionUnavailable(false);
        setLoading(false);
      },
      onUnavailable: () => {
        // Keep the authenticated user and the current activity mounted while a
        // temporary network or server failure is retried.
        setSessionUnavailable(true);
        setLoading(false);
      }
    });
  }

  const refresh = useCallback(() => refresherRef.current!(), []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
      setSessionUnavailable(false);
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
  }, [refresh]);

  useEffect(() => {
    if (!user && !sessionUnavailable) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, sessionUnavailable ? 10_000 : 60_000);

    return () => window.clearInterval(intervalId);
  }, [refresh, sessionUnavailable, user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      sessionUnavailable,
      refresh,
      login: async (email, password) => {
        const result = await api.login(email, password);
        setUser(result.user);
        setSessionUnavailable(false);
        return result.user;
      },
      activateAccount: async (input) => {
        const result = await api.activateAccount(input);
        setUser(result.user);
        setSessionUnavailable(false);
        return result.user;
      },
      logout: async () => {
        await api.logout();
        setUser(null);
        setSessionUnavailable(false);
      }
    }),
    [user, loading, sessionUnavailable, refresh]
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
