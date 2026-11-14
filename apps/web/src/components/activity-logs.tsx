"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppDateTime, useNotifications } from "@cognelo/activity-ui";
import type { ActivityLogPage } from "@cognelo/contracts";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { AppIcon } from "./app-icon";

export function ActivityLogs({ courseId, activityId, groupId }: { courseId: string; activityId: string; groupId?: string }) {
  const { locale, t } = useI18n(), notifications = useNotifications();
  const [page, setPage] = useState<ActivityLogPage | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor?: ActivityLogPage["nextCursor"]) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const next = await api.activityLogs(courseId, activityId, groupId, cursor ?? undefined, controller.signal);
      if (!controller.signal.aborted) setPage(previous => ({ ...next, entries: cursor && previous ? [...new Map([...previous.entries, ...next.entries].map(entry => [entry.id, entry])).values()] : next.entries }));
    } catch (failure) {
      if (!controller.signal.aborted) { const message = failure instanceof Error ? failure.message : t("activityLogs.loadError"); setError(message); notifications.error(message); }
    } finally { if (request.current === controller) setLoading(false); }
  }, [courseId, activityId, groupId, notifications, t]);
  useEffect(() => { setPage(null); void load(); return () => request.current?.abort(); }, [load]);
  return <section className="stack activity-logs" aria-label={t("activityLogs.title")}>
    <div className="row"><h2>{t("activityLogs.title")}</h2><button className="secondary" type="button" disabled={loading} onClick={() => void load()}><AppIcon name="refresh" />{t("activityLogs.refresh")}</button></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {loading && !page ? <p role="status">{t("common.loading")}</p> : null}
    {page?.entries.length === 0 ? <p className="muted">{t("activityLogs.empty")}</p> : null}
    <ol className="activity-log-list">{page?.entries.map(entry => <li className="activity-log-entry" key={entry.id}>
      <div><strong>{t(`activityLogs.events.${entry.type}`)}</strong><div className="muted"><AppDateTime value={entry.at} locale={locale} options={{ dateStyle: "medium", timeStyle: "medium" }} /></div></div>
      <div><strong>{entry.student}</strong><div className="muted">{entry.group}</div></div>
      <div>{entry.actor ? <div>{t("activityLogs.actor", { name: entry.actor })}</div> : null}{entry.attemptNumber ? <div className="muted">{t("activityLogs.attempt", { number: entry.attemptNumber })}</div> : null}</div>
      {entry.reason ? <p className="activity-log-reason">{entry.reason}</p> : null}
    </li>)}</ol>
    {page?.nextCursor ? <button className="secondary" type="button" disabled={loading} onClick={() => void load(page.nextCursor)}>{t("activityLogs.more")}</button> : null}
  </section>;
}
