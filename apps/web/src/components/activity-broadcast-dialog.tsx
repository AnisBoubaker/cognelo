"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { ActivityChatComposer, ActivityChatDialog, ActivityChatThread } from "@/components/activity-chat";
import { applyChatDeletion, mergeChatMessages } from "@/lib/activity-chat-history";
import { api, type ActivityMessagingOverview, type StaffActivityConversation } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ActivityBroadcastDialog({ courseId, activityId, groupId, onClose, updateKey }: {
  courseId: string; activityId: string; groupId?: string; onClose: () => void; updateKey: string;
}) {
  const { t } = useI18n();
  const [overview, setOverview] = useState<ActivityMessagingOverview | null>(null);
  const [selected, setSelected] = useState("broadcast");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const result = await api.activityMessagingOverview(courseId, activityId, groupId);
    setError("");
    setOverview((old) => ({ ...result.messaging,
      broadcasts: mergeChatMessages(old?.broadcasts ?? [], result.messaging.broadcasts, result.messaging.deletedBroadcasts),
      hasMoreBroadcasts: old && old.broadcasts.length > result.messaging.broadcasts.length ? old.hasMoreBroadcasts : result.messaging.hasMoreBroadcasts
    }));
  }, [activityId, courseId, groupId]);
  useEffect(() => {
    let cancelled = false;
    const load = () => refresh().catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : t("activityMessenger.loadError")); });
    void load();
    return () => { cancelled = true; };
  }, [refresh, t, updateKey]);
  async function olderBroadcasts() {
    if (!overview?.broadcasts[0]) return;
    try {
      const result = await api.activityMessagingOverview(courseId, activityId, groupId, overview.broadcasts[0].id);
      setOverview((old) => old ? { ...old, broadcasts: mergeChatMessages(old.broadcasts, result.messaging.broadcasts, result.messaging.deletedBroadcasts), hasMoreBroadcasts: result.messaging.hasMoreBroadcasts } : old);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("activityMessenger.loadError")); }
  }
  return <ActivityChatDialog wide onClose={onClose}>
    <div className="activity-chat-workspace">
      <div className="activity-chat-tabs" role="tablist" aria-label={t("activityMessenger.conversations")} aria-orientation="vertical"
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
          const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
          const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
          event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click();
        }}>
        <button type="button" role="tab" id="chat-tab-broadcast" aria-controls="activity-chat-panel" aria-selected={selected === "broadcast"} tabIndex={selected === "broadcast" ? 0 : -1} onClick={() => setSelected("broadcast")}><AppIcon name="messages" />{t("activityMessenger.broadcastTab")}</button>
        {overview?.conversations.map((conversation) => <button key={conversation.participantId} id={`chat-tab-${conversation.participantId}`} type="button" role="tab" aria-controls="activity-chat-panel" aria-selected={selected === conversation.participantId} tabIndex={selected === conversation.participantId ? 0 : -1} onClick={() => setSelected(conversation.participantId)}>
          <span className="activity-chat-avatar" aria-hidden="true">{conversation.studentName.slice(0, 1)}</span>
          <span><strong>{conversation.studentName}</strong><small>{conversation.groupTitle}</small></span>
          {conversation.unread ? <span className="activity-chat-unread" aria-label={t("activityMessenger.unread")} /> : null}
        </button>)}
        {overview && !overview.conversations.length ? <p className="muted activity-chat-sidebar-hint">{t("activityMessenger.noConversations")}</p> : null}
      </div>
      <div className="activity-chat-panel" id="activity-chat-panel" role="tabpanel" aria-labelledby={`chat-tab-${selected}`}>
        {selected === "broadcast" ? <>
          <div className="activity-chat-context"><strong>{t("activityMessenger.broadcastTab")}</strong><small className="muted">{t("activityMessenger.allStudents", { count: overview?.recipientCount ?? 0 })} · {t("activityMessenger.activeAttempts", { count: overview?.activeRecipientCount ?? 0 })}</small></div>
          <ActivityChatThread messages={(overview?.broadcasts ?? []).map((broadcast) => ({ ...broadcast, broadcastId: broadcast.id, senderKind: "staff", attemptNumber: 0, testItemContext: null }))} ownKind="staff" onDelete={async (message) => {
            const deletion = await api.deleteActivityMessage(courseId, activityId, { broadcastId: message.broadcastId! });
            setOverview((old) => old ? { ...old, broadcasts: applyChatDeletion(old.broadcasts, deletion) } : old);
          }} hasMore={overview?.hasMoreBroadcasts} onLoadMore={olderBroadcasts} loading={!overview && !error} empty={t("activityMessenger.noBroadcasts")} />
          {overview?.broadcasts.at(-1) ? <small className="muted activity-chat-delivery">{t("activityMessenger.deliverySummary", { recipients: overview.broadcasts.at(-1)!.recipientCount, read: overview.broadcasts.at(-1)!.readCount })}</small> : null}
          {overview?.enabled && overview.recipientCount ? <ActivityChatComposer broadcast onSend={async (body) => { await api.sendActivityBroadcast(courseId, activityId, body, groupId); void refresh().catch(() => undefined); }} /> : <p className="muted activity-chat-notice">{t("activityMessenger.disabled")}</p>}
        </> : <StaffActivityChat key={selected} courseId={courseId} activityId={activityId} participantId={selected} updateKey={updateKey} onRead={refresh} />}
      </div>
    </div>
    {error ? <div className="activity-chat-notice"><p role="alert" className="error">{error}</p><button className="secondary" type="button" onClick={() => void refresh().catch(() => undefined)}><AppIcon name="refresh" />{t("common.retry")}</button></div> : null}
  </ActivityChatDialog>;
}

export function StaffActivityChat({ courseId, activityId, participantId, attemptId, onRead, readOnly = false, updateKey }: {
  courseId: string; activityId: string; participantId: string; attemptId?: string; onRead?: () => Promise<void>; readOnly?: boolean; updateKey?: string;
}) {
  const { t } = useI18n();
  const [conversation, setConversation] = useState<StaffActivityConversation | null>(null);
  const [error, setError] = useState("");
  const readId = useRef<string | null>(null);
  const onReadRef = useRef(onRead); onReadRef.current = onRead;
  const refresh = useCallback(async (before?: string) => {
    const result = await api.staffActivityConversation(courseId, activityId, participantId, { attemptId, before });
    setError("");
    setConversation((old) => ({ ...result.conversation,
      messages: mergeChatMessages(old?.messages ?? [], result.conversation.messages, result.conversation.deletedMessages),
      hasMore: !before && old && old.messages.length > result.conversation.messages.length ? old.hasMore : result.conversation.hasMore
    }));
    const last = result.conversation.messages.at(-1)?.id;
    if (!before && last && readId.current !== last) {
      await api.markStaffActivityConversationRead(courseId, activityId, participantId, last, attemptId);
      readId.current = last;
      await onReadRef.current?.();
    }
  }, [activityId, attemptId, courseId, participantId]);
  useEffect(() => {
    const load = () => refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("activityMessenger.loadError")));
    void load();
  }, [refresh, t, updateKey]);
  return <>
    <div className="activity-chat-context"><strong>{conversation?.studentName ?? t("common.loading")}</strong><small className="muted">{t("activityMessenger.privateHelp")}</small></div>
    <ActivityChatThread messages={conversation?.messages ?? []} ownKind="staff" onDelete={async (message) => {
      const deletion = await api.deleteActivityMessage(courseId, activityId, message.broadcastId ? { broadcastId: message.broadcastId } : { messageId: message.id });
      setConversation((old) => old ? { ...old, messages: applyChatDeletion(old.messages, deletion) } : old);
      void onReadRef.current?.().catch(() => undefined);
    }} loading={!conversation && !error} hasMore={conversation?.hasMore} onLoadMore={async () => {
      try { await refresh(conversation?.messages[0]?.id); } catch (cause) { setError(cause instanceof Error ? cause.message : t("activityMessenger.loadError")); }
    }} />
    {conversation?.canSend && !attemptId && !readOnly ? <ActivityChatComposer onSend={async (body) => { await api.sendStaffActivityReply(courseId, activityId, participantId, body); void refresh().catch(() => undefined); }} /> : <p className="muted activity-chat-notice">{t("activityMessenger.readOnly")}</p>}
    {error ? <div className="activity-chat-notice"><p className="error" role="alert">{error}</p><button className="secondary" type="button" onClick={() => void refresh().catch(() => undefined)}><AppIcon name="refresh" />{t("common.retry")}</button></div> : null}
  </>;
}
