"use client";

import { AppIcon } from "@/components/app-icon";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ACTIVITY_CONTENT_CLOSED_EVENT, AppDateTime } from "@cognelo/activity-ui";
import { useAuth } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { api, type ActivityContentAccess, type LearnerActivityMessagingStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const ActivityMessagingContext = createContext<{
  status: LearnerActivityMessagingStatus | null;
  presence: { current: boolean };
} | null>(null);
export function useActivityMessagingStatus() { return useContext(ActivityMessagingContext); }

export function ActivityContentBoundary({ children }: { children: ReactNode }) {
  const { courseId, groupId, activityId } = useParams<{ courseId: string; groupId: string; activityId: string }>();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const presence = useRef(true);
  const [messaging, setMessaging] = useState<LearnerActivityMessagingStatus | null>(null);
  const [access, setAccess] = useState<ActivityContentAccess | null>(null);
  const scope = `${courseId}/${groupId}/${activityId}/${user?.id ?? ""}`;
  const [loadedScope, setLoadedScope] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let pending = false;
    let revision = 0;
    const prefix = `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityId}`;
    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      const requestedRevision = revision;
      try {
        const { access: next, messaging: status } = await api.activityContentAccess(courseId, groupId, activityId, presence.current ? "presence" : "history");
        if (cancelled || requestedRevision !== revision) return;
        setAccess(next); setMessaging(status ?? null); setLoadedScope(scope); setError("");
        if (next.locked && next.canFinalize) {
          const result = await api.finalizeClosedActivityContent(courseId, groupId, activityId);
          if (!cancelled && requestedRevision === revision) setAccess(result.access);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t("activityContentAccess.loadError"));
      } finally {
        pending = false;
        if (!cancelled && requestedRevision !== revision) void refresh();
      }
    }
    function closed(event: Event) {
      const path = (event as CustomEvent<{ path: string }>).detail?.path;
      if (path !== prefix && !path?.startsWith(`${prefix}/`)) return;
      revision++;
      setAccess((current) => current ? { ...current, locked: true, canFinalize: false } : null);
      void refresh();
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(ACTIVITY_CONTENT_CLOSED_EVENT, closed);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener(ACTIVITY_CONTENT_CLOSED_EVENT, closed); };
  }, [activityId, courseId, groupId, retry, scope, t, user]);

  const currentAccess = loadedScope === scope ? access : null;
  if (currentAccess && !currentAccess.locked) return <ActivityMessagingContext.Provider value={{ status: messaging, presence }}>{children}</ActivityMessagingContext.Provider>;
  return <AppShell><main className="page stack">
    <div className="row" style={{ justifyContent: "flex-end" }}><Link className="button secondary" href={`/courses/${courseId}/groups/${groupId}`}><AppIcon name="back" /> {t("courseDetail.backToCourseContent")}</Link></div>
    {currentAccess?.locked ? <section className="section stack">
      <h1 className="section-title">{currentAccess.title}</h1>
      <p role="status">{t("activityContentAccess.closed")}</p>
      {currentAccess.receipts.length ? <ul>{currentAccess.receipts.map((receipt) => <li key={receipt.attemptNumber}>
        {t(receipt.deleted ? "activityContentAccess.deletedReceipt" : "activityContentAccess.receipt", { number: receipt.attemptNumber })}
        {receipt.submittedAt ? <> · <AppDateTime value={receipt.submittedAt} locale={locale} /></> : null}
        {receipt.reason ? <p className="muted">{receipt.reason}</p> : null}
      </li>)}</ul> : null}
      {currentAccess.grade ? <p>{t("groupPage.finalGradeLabel")}: {currentAccess.grade.score} / {currentAccess.grade.maxScore}</p> : null}
    </section> : <p>{t("common.loading")}</p>}
    {error ? <div role="alert"><p>{error}</p><button onClick={() => setRetry((value) => value + 1)}><AppIcon name="refresh" /> {t("common.retry")}</button></div> : null}
  </main></AppShell>;
}
