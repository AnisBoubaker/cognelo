"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApplicationTimeProvider } from "@cognelo/activity-ui";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function AppTimeProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const anchor = useRef({ server: 0, monotonic: 0 });
  const refresh = useCallback(async () => {
    const start = performance.now();
    try {
      const snapshot = await api.applicationTime();
      const end = performance.now();
      const server = Date.parse(snapshot.serverNow);
      if (!Number.isFinite(server)) throw new Error("Invalid server time");
      new Intl.DateTimeFormat("en", { timeZone: snapshot.timeZone });
      anchor.current = { server: server + (end - start) / 2, monotonic: end };
      // Existing forms keep the zone they opened with; new pages adopt configuration on reload.
      setTimeZone((current) => current ?? snapshot.timeZone);
      setFailed(false);
    } catch { setFailed(true); }
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
  if (!timeZone) return <main className="page stack"><p role={failed ? "alert" : undefined}>{t(failed ? "timeSettings.loadError" : "common.loading")}</p>{failed ? <button onClick={() => void refresh()}>{t("common.retry")}</button> : null}</main>;
  return <ApplicationTimeProvider value={value}>{children}</ApplicationTimeProvider>;
}
