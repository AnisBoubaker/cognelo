"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityLiveControlPortal } from "@/components/activity-live-controls";
import { AppIcon } from "@/components/app-icon";
import { api, type LearnerActivityConversation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ActivityMessenger({
  courseId,
  groupId,
  activityId,
  enabled
}: {
  courseId: string;
  groupId: string;
  activityId: string;
  enabled: boolean;
}) {
  const { locale, t } = useI18n();
  const [conversation, setConversation] = useState<LearnerActivityConversation | null>(null);
  const [open, setOpen] = useState(false);
  const currentConversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    // `enabled` means this is an active learner view. Keep polling when the
    // activity's messaging switch is off so it can become available live.
    if (!enabled || document.visibilityState !== "visible") return;
    try {
      const result = await api.learnerActivityConversation(courseId, groupId, activityId);
      const nextId = result.conversation?.id ?? null;
      if (currentConversationIdRef.current && currentConversationIdRef.current !== nextId) {
        setOpen(false);
      }
      currentConversationIdRef.current = nextId;
      setConversation(result.conversation);
    } catch {
      // Preserve the last successful conversation during transient polling failures.
    }
  }, [activityId, courseId, enabled, groupId]);

  useEffect(() => {
    if (!enabled) {
      currentConversationIdRef.current = null;
      setConversation(null);
      setOpen(false);
      return;
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  const markRead = useCallback(async (current: LearnerActivityConversation) => {
    setConversation((value) => value?.id === current.id ? { ...value, unreadCount: 0 } : value);
    try {
      await api.markLearnerActivityConversationRead(courseId, groupId, activityId, current.id);
    } catch {
      // The next poll restores the unread marker when the acknowledgement failed.
    }
  }, [activityId, courseId, groupId]);

  useEffect(() => {
    if (!open || !conversation?.unreadCount) return;
    void markRead(conversation);
  }, [conversation, markRead, open]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [conversation?.messages.length, open]);

  if (!conversation) return null;

  return (
    <>
      <ActivityLiveControlPortal>
        <button
          aria-label={conversation.unreadCount
            ? t("activityMessenger.openUnread", { count: conversation.unreadCount })
            : t("activityMessenger.open")}
          className={`activity-messenger-trigger${conversation.unreadCount ? " has-unread" : ""}`}
          type="button"
          onClick={() => {
            setOpen(true);
            if (conversation.unreadCount) void markRead(conversation);
          }}
        >
          <AppIcon name="messages" size={22} />
          <span className="activity-messenger-label">{t("activityMessenger.label")}</span>
          {conversation.unreadCount ? <span aria-hidden="true" className="activity-messenger-unread-dot" /> : null}
        </button>
      </ActivityLiveControlPortal>

      {open ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="activity-messenger-title" aria-modal="true" className="dialog-panel activity-messenger-dialog" role="dialog">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("activityMessenger.attempt", { count: conversation.attemptNumber })}</p>
                <h2 id="activity-messenger-title">{t("activityMessenger.title")}</h2>
              </div>
              <button className="secondary icon-button" type="button" title={t("common.close")} onClick={() => setOpen(false)}>
                <AppIcon name="close" />
              </button>
            </div>
            <div className="activity-messenger-thread" role="log" aria-live="polite">
              {conversation.messages.length ? conversation.messages.map((message) => (
                <article className={`activity-message activity-message--${message.senderKind}`} key={message.id}>
                  <div className="activity-message-meta">
                    <strong>{message.senderName}</strong>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt, locale)}</time>
                  </div>
                  <p>{message.body}</p>
                </article>
              )) : <p className="muted activity-messenger-empty">{t("activityMessenger.empty")}</p>}
              <div ref={messagesEndRef} />
            </div>
            <p className="muted activity-messenger-one-way">{t("activityMessenger.oneWayHelp")}</p>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatMessageTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
