"use client";

import { AppIcon } from "@/components/app-icon";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApplicationTimeProvider } from "@cognelo/activity-ui";
import { systemErrorMessage, type SystemErrorCode } from "@cognelo/contracts";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { localizedSystemError } from "@/lib/system-errors";

export function AppTimeProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [failure, setFailure] = useState<SystemErrorCode | null>(null);
  const anchor = useRef({ server: 0, monotonic: 0 });
  const refresh = useCallback(async () => {
    const start = performance.now();
    try {
      const snapshot = await api.applicationTime();
      const end = performance.now();
      let server: number;
      try {
        server = typeof snapshot?.serverNow === "string" ? Date.parse(snapshot.serverNow) : NaN;
        if (!Number.isFinite(server) || typeof snapshot?.timeZone !== "string" || !snapshot.timeZone) throw new Error();
        new Intl.DateTimeFormat("en", { timeZone: snapshot.timeZone });
      } catch { throw new ApiError(systemErrorMessage("SYS-008"), { systemCode: "SYS-008" }); }
      anchor.current = { server: server + (end - start) / 2, monotonic: end };
      // Existing forms keep the zone they opened with; new pages adopt configuration on reload.
      setTimeZone((current) => current ?? snapshot.timeZone);
      setFailure(null);
    } catch (error) { setFailure(error instanceof ApiError ? error.systemCode ?? "SYS-001" : "SYS-001"); }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", focus);
    return () => { clearInterval(interval); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [refresh]);
  const now = useCallback(() => anchor.current.server + performance.now() - anchor.current.monotonic, []);
  const value = useMemo(() => ({ timeZone: timeZone ?? "UTC", now, setTimeZone }), [timeZone, now]);
  if (!timeZone) return <main className="page stack"><p role={failure ? "alert" : undefined}>{failure ? localizedSystemError(failure, t) : t("common.loading")}</p>{failure ? <button onClick={() => void refresh()}><AppIcon name="refresh" /> {t("common.retry")}</button> : null}</main>;
  return <ApplicationTimeProvider value={value}>{children}</ApplicationTimeProvider>;
}
