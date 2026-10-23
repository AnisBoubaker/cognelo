"use client";

import { useApplicationTime, useBodyScrollLock } from "@cognelo/activity-ui";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TeacherMessageSoundToggle, TeacherMessageUnreadBadge } from "@/components/teacher-message-alerts";
import { AppIcon } from "@/components/app-icon";
import type { ActivityConversationMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ActivityChatDialog({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    const composer = element?.querySelector<HTMLTextAreaElement>(".activity-chat-composer textarea:not(:disabled)");
    (composer ?? heading.current)?.focus({ preventScroll: true });
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  return createPortal(
    <dialog ref={dialog} aria-labelledby={titleId} className={`dialog-panel activity-chat-dialog${wide ? " activity-chat-dialog--wide" : ""}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="activity-chat-heading">
        <h2 id={titleId} ref={heading} tabIndex={-1} data-chat-title><AppIcon name="messages" /> {t("activityMessenger.title")}</h2>
        <div className="activity-chat-heading-actions"><TeacherMessageUnreadBadge /><TeacherMessageSoundToggle />
        <button className="secondary icon-button" type="button" aria-label={t("common.close")} onClick={onClose}><AppIcon name="close" /></button>
        </div>
      </div>
      {children}
    </dialog>, document.body
  );
}

export function ActivityChatThread({ messages, ownKind, hasMore, onLoadMore, loading = false, empty, onDelete }: {
  messages: ActivityConversationMessage[]; ownKind: "student" | "staff"; hasMore?: boolean;
  onLoadMore?: () => Promise<void>; loading?: boolean; empty?: string; onDelete?: (message: ActivityConversationMessage) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const { timeZone } = useApplicationTime();
  const scroller = useRef<HTMLDivElement>(null);
  const previousLast = useRef<string | undefined>(undefined);
  const nearBottom = useRef(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const lastId = messages.at(-1)?.id;
  useLayoutEffect(() => {
    if (lastId !== previousLast.current && nearBottom.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    previousLast.current = lastId;
  }, [lastId]);
  async function loadOlder() {
    if (!onLoadMore) return;
    const previousHeight = scroller.current?.scrollHeight ?? 0;
    const previousTop = scroller.current?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      await onLoadMore();
      requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = previousTop + scroller.current.scrollHeight - previousHeight; });
    } finally { setLoadingOlder(false); }
  }
  async function deleteMessage(message: ActivityConversationMessage) {
    if (!onDelete || deletingId) return;
    setDeletingId(message.id); setDeleteError("");
    try { await onDelete(message); }
    catch (cause) { setDeleteError(cause instanceof Error ? cause.message : t("activityMessenger.deleteError")); }
    finally { setDeletingId(null); }
  }
  return <div className="activity-chat-thread" ref={scroller} role="log" aria-label={t("activityMessenger.title")} aria-live="polite"
    onScroll={() => { const element = scroller.current; if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
    {hasMore ? <button className="secondary activity-chat-older" type="button" disabled={loadingOlder} onClick={() => void loadOlder()}><AppIcon name="history" /> {t("activityMessenger.older")}</button> : null}
    {loading ? <p className="muted activity-messenger-empty">{t("common.loading")}</p> : !messages.length ? <p className="muted activity-messenger-empty">{empty ?? t("activityMessenger.empty")}</p> : null}
    {messages.map((message) => <article className={`activity-chat-bubble${message.broadcastId ? " activity-chat-bubble--broadcast" : message.senderKind === ownKind ? " activity-chat-bubble--own" : ""}`} key={message.id}>
      <div className="activity-message-meta"><strong>{message.senderName}</strong>{message.broadcastId ? <span className="activity-chat-badge">{t("activityMessenger.broadcastTab")}</span> : null}</div>
      {message.testItemContext ? <p className="activity-chat-exercise">{t("activityMessenger.testExercise", { number: message.testItemContext.exerciseNumber, title: message.testItemContext.title })}</p> : null}
      <p>{message.deletedAt ? <del dateTime={message.deletedAt}>{message.body}</del> : message.body}</p>
      <div className="activity-chat-message-footer">
        {message.deletedAt ? <span className="activity-chat-deleted">{t("activityMessenger.deleted")}</span> : null}
        {onDelete && message.canDelete && !message.deletedAt ? <button className="danger icon-button activity-chat-delete" type="button" disabled={deletingId !== null}
          aria-label={t(message.broadcastId ? "activityMessenger.deleteBroadcast" : "activityMessenger.deleteMessage")}
          title={t(message.broadcastId ? "activityMessenger.deleteBroadcast" : "activityMessenger.deleteMessage")}
          onClick={() => void deleteMessage(message)}><AppIcon name="remove" size={16} /></button> : null}
        {message.attemptNumber > 0 ? <span>{t("activityMessenger.attempt", { count: message.attemptNumber })}</span> : null}
        <time dateTime={message.createdAt}>{new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</time>
      </div>
    </article>)}
    {deleteError ? <p className="error" role="alert">{deleteError}</p> : null}
  </div>;
}

export function ActivityChatComposer({ onSend, broadcast = false }: { onSend: (body: string) => Promise<void>; broadcast?: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = input.current;
    const dialog = field?.closest("dialog");
    // A lazy-loaded composer may replace the initial heading focus, but must not
    // steal focus after the teacher has chosen another control or conversation.
    if (dialog?.open && (document.activeElement === dialog || document.activeElement === dialog.querySelector("[data-chat-title]"))) {
      field?.focus({ preventScroll: true });
    }
  }, []);
  async function send() {
    if (!body.trim() || sending) return;
    setSending(true); setError("");
    try { await onSend(body.trim()); setBody(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("activityMessenger.sendError")); }
    finally { setSending(false); input.current?.focus(); }
  }
  return <form className="activity-chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
    <label className="sr-only" htmlFor={id}>{t("activityMessenger.messageLabel")}</label>
    <textarea ref={input} id={id} rows={2} maxLength={2000} value={body} disabled={sending} placeholder={t("activityMessenger.messagePlaceholder")}
      onChange={(event) => setBody(event.target.value)} />
    <div className="activity-chat-composer-actions"><small className="muted">{body.length}/2000</small>
      <button type="submit" disabled={sending || !body.trim()}><AppIcon name="submit" />{sending ? t("activityMessenger.sending") : t(broadcast ? "activityMessenger.sendBroadcast" : "activityMessenger.send")}</button>
    </div>
    {error ? <p className="error" role="alert">{error}</p> : null}
  </form>;
}
