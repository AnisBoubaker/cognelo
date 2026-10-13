"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { api, type ActivityMessagingOverview } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useNotifications } from "@cognelo/activity-ui";

export function ActivityBroadcastDialog({
  courseId,
  activityId,
  groupId,
  onClose
}: {
  courseId: string;
  activityId: string;
  groupId?: string;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const notifications = useNotifications();
  const [overview, setOverview] = useState<ActivityMessagingOverview | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (showError = false) => {
    try {
      const result = await api.activityMessagingOverview(courseId, activityId, groupId);
      setOverview(result.messaging);
      setError("");
    } catch (refreshError) {
      if (showError) setError(refreshError instanceof Error ? refreshError.message : t("activityMessenger.loadError"));
    } finally {
      setLoading(false);
    }
  }, [activityId, courseId, groupId, t]);

  useEffect(() => {
    void refresh(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = body.trim();
    if (!message || !overview?.enabled || !overview.activeRecipientCount) return;
    setSending(true);
    setError("");
    try {
      await api.sendActivityBroadcast(courseId, activityId, message, groupId);
      setBody("");
      await refresh();
      notifications.success(t("activityMessenger.sent"));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t("activityMessenger.sendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="activity-broadcast-title" aria-modal="true" className="dialog-panel activity-broadcast-dialog" role="dialog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("activityMessenger.teacherEyebrow")}</p>
            <h2 id="activity-broadcast-title">{t("activityMessenger.broadcastTitle")}</h2>
          </div>
          <button className="secondary icon-button" disabled={sending} type="button" title={t("common.close")} onClick={onClose}>
            <AppIcon name="close" />
          </button>
        </div>

        <form className="form activity-broadcast-composer" onSubmit={send}>
          {overview && !overview.enabled ? <p className="muted" role="status">{t("activityMessenger.disabled")}</p> : null}
          <div className="activity-broadcast-presence" role="status">
            <span aria-hidden="true" className={`activity-presence-dot${overview?.activeRecipientCount ? " is-active" : ""}`} />
            {loading
              ? t("common.loading")
              : t("activityMessenger.activeAttempts", { count: overview?.activeRecipientCount ?? 0 })}
          </div>
          <div className="field">
            <label htmlFor="activity-broadcast-body">{t("activityMessenger.messageLabel")}</label>
            <textarea
              autoFocus
              disabled={!overview?.enabled || sending}
              id="activity-broadcast-body"
              maxLength={2000}
              placeholder={t("activityMessenger.messagePlaceholder")}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="field-hint-row">
              <span className="muted">{t("activityMessenger.currentAttemptsOnly")}</span>
              <span className="muted">{body.length}/2000</span>
            </div>
          </div>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <button className="secondary" disabled={sending} type="button" onClick={onClose}>{t("common.cancel")}</button>
            <button disabled={sending || !body.trim() || !overview?.enabled || !overview.activeRecipientCount} type="submit">
              <AppIcon name="messages" />
              {sending ? t("activityMessenger.sending") : t("activityMessenger.sendBroadcast")}
            </button>
          </div>
        </form>

        <div className="activity-broadcast-history">
          <h3>{t("activityMessenger.broadcastHistory")}</h3>
          {overview?.broadcasts.length ? overview.broadcasts.map((broadcast) => (
            <article className="activity-broadcast-history-item" key={broadcast.id}>
              <div className="activity-message-meta">
                <strong>{broadcast.senderName}</strong>
                <time dateTime={broadcast.createdAt}>{formatMessageTime(broadcast.createdAt, locale)}</time>
              </div>
              <p>{broadcast.body}</p>
              <small className="muted">
                {t("activityMessenger.deliverySummary", {
                  recipients: broadcast.recipientCount,
                  read: broadcast.readCount
                })}
              </small>
            </article>
          )) : !loading ? <p className="muted">{t("activityMessenger.noBroadcasts")}</p> : null}
        </div>
      </section>
    </div>
  );
}

function formatMessageTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
