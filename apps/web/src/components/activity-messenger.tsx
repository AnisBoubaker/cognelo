"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActivityMessagingStatus } from "@/components/activity-content-boundary";
import { ActivityLiveControlPortal } from "@/components/activity-live-controls";
import { ActivityChatComposer, ActivityChatDialog, ActivityChatThread, mergeChatMessages } from "@/components/activity-chat";
import { AppIcon } from "@/components/app-icon";
import { api, type LearnerActivityConversation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ActivityMessenger({ courseId, groupId, activityId, enabled, historyOnly = false }: {
  courseId: string; groupId: string; activityId: string; enabled: boolean; historyOnly?: boolean;
}) {
  const { t } = useI18n();
  const messaging = useActivityMessagingStatus();
  const status = enabled ? messaging?.status : null;
  const statusVersion = status?.version;
  const presence = messaging?.presence;
  const [readVersion, setReadVersion] = useState("");
  const [conversation, setConversation] = useState<LearnerActivityConversation | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const readId = useRef<string | null>(null);
  const refresh = useCallback(async (before?: string) => {
    if (!enabled || document.visibilityState !== "visible") return;
    const requestGeneration = generation.current;
    try {
      const result = await api.learnerActivityConversation(courseId, groupId, activityId, { before, history: historyOnly });
      if (requestGeneration !== generation.current) return;
      if (!result.conversation) { setConversation(null); setOpen(false); return; }
      const next = result.conversation;
      setConversation((old) => ({ ...next, messages: mergeChatMessages(old?.messages ?? [], next.messages),
        hasMore: !before && old && old.messages.length > next.messages.length ? old.hasMore : next.hasMore }));
      setError("");
    } catch (cause) {
      // Closed activity content must disappear even if the parent boundary is still polling.
      if (cause && typeof cause === "object" && "status" in cause && (cause.status === 403 || cause.status === 404)) {
        setConversation(null); setOpen(false);
      } else setError(cause instanceof Error ? cause.message : t("activityMessenger.loadError"));
    }
  }, [activityId, courseId, enabled, groupId, historyOnly, t]);
  useEffect(() => {
    if (presence) presence.current = enabled && !historyOnly;
    return () => { if (presence) presence.current = false; };
  }, [enabled, historyOnly, presence]);
  useEffect(() => {
    generation.current += 1;
    setConversation(null); setOpen(false); readId.current = null;
    return () => { generation.current += 1; };
  }, [activityId, courseId, groupId, enabled]);
  useEffect(() => {
    if (!statusVersion) { setOpen(false); setConversation(null); return; }
    if (open) void refresh();
  }, [open, statusVersion, refresh]);
  useEffect(() => {
    const last = conversation?.messages.at(-1)?.id;
    if (!open || !conversation || !last || readId.current === last) return;
    readId.current = last;
    void api.markLearnerActivityConversationRead(courseId, groupId, activityId, conversation.id, last).then(() => {
      setReadVersion(statusVersion ?? "");
      setConversation((current) => current ? { ...current, unreadCount: 0 } : current);
    }).catch(() => { readId.current = null; });
  }, [activityId, conversation, courseId, groupId, open, statusVersion]);
  if (!status) return null;
  const unreadCount = readVersion === status.version ? 0 : status.unreadCount;
  return <>
    <ActivityLiveControlPortal>
      <button aria-label={unreadCount ? t("activityMessenger.openUnread", { count: unreadCount }) : t("activityMessenger.open")}
        className={`activity-messenger-trigger${unreadCount ? " has-unread" : ""}`} type="button" onClick={() => setOpen(true)}>
        <AppIcon name="messages" size={22} /><span className="activity-messenger-label">{t("activityMessenger.label")}</span>
        {unreadCount ? <span aria-hidden="true" className="activity-messenger-unread-dot" /> : null}
      </button>
    </ActivityLiveControlPortal>
    {open ? <ActivityChatDialog onClose={() => setOpen(false)}>
      <div className="activity-chat-panel">
        <div className="activity-chat-context"><strong>{t("activityMessenger.attempt", { count: conversation?.attemptNumber ?? status.attemptNumber })}</strong><small className="muted">{t("activityMessenger.studentHelp")}</small></div>
        <ActivityChatThread messages={conversation?.messages ?? []} loading={!conversation && !error} ownKind="student" hasMore={conversation?.hasMore} onLoadMore={() => refresh(conversation?.messages[0]?.id)} />
        {status.canSend && !historyOnly ? <ActivityChatComposer onSend={async (body) => { await api.sendLearnerActivityMessage(courseId, groupId, activityId, body); await refresh(); }} />
          : <p className="muted activity-chat-notice">{t("activityMessenger.readOnly")}</p>}
        {error ? <div className="activity-chat-notice"><p className="error" role="alert">{error}</p><button className="secondary" type="button" onClick={() => void refresh()}><AppIcon name="refresh" />{t("common.retry")}</button></div> : null}
      </div>
    </ActivityChatDialog> : null}
  </>;
}
