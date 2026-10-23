"use client";

import { useApplicationTime, useBodyScrollLock } from "@cognelo/activity-ui";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/app-icon";
import type { ActivityConversationMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function ActivityChatDialog({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previousFocus?.focus(); };
  }, []);
  return createPortal(
    <dialog ref={dialog} aria-labelledby={titleId} className={`dialog-panel activity-chat-dialog${wide ? " activity-chat-dialog--wide" : ""}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="activity-chat-heading">
        <h2 id={titleId}><AppIcon name="messages" /> {t("activityMessenger.title")}</h2>
        <button className="secondary icon-button" type="button" aria-label={t("common.close")} onClick={onClose}><AppIcon name="close" /></button>
      </div>
      {children}
    </dialog>, document.body
  );
}

export function ActivityChatThread({ messages, ownKind, hasMore, onLoadMore, loading = false, empty }: {
  messages: ActivityConversationMessage[]; ownKind: "student" | "staff"; hasMore?: boolean;
  onLoadMore?: () => Promise<void>; loading?: boolean; empty?: string;
}) {
  const { t, locale } = useI18n();
  const { timeZone } = useApplicationTime();
  const scroller = useRef<HTMLDivElement>(null);
  const previousLast = useRef<string | undefined>(undefined);
  const nearBottom = useRef(true);
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
  return <div className="activity-chat-thread" ref={scroller} role="log" aria-label={t("activityMessenger.title")} aria-live="polite"
    onScroll={() => { const element = scroller.current; if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }}>
    {hasMore ? <button className="secondary activity-chat-older" type="button" disabled={loadingOlder} onClick={() => void loadOlder()}><AppIcon name="history" /> {t("activityMessenger.older")}</button> : null}
    {loading ? <p className="muted activity-messenger-empty">{t("common.loading")}</p> : !messages.length ? <p className="muted activity-messenger-empty">{empty ?? t("activityMessenger.empty")}</p> : null}
    {messages.map((message) => <article className={`activity-chat-bubble${message.broadcastId ? " activity-chat-bubble--broadcast" : message.senderKind === ownKind ? " activity-chat-bubble--own" : ""}`} key={message.id}>
      <div className="activity-message-meta"><strong>{message.senderName}</strong>{message.broadcastId ? <span className="activity-chat-badge">{t("activityMessenger.broadcastTab")}</span> : null}</div>
      <p>{message.body}</p>
      <div className="activity-chat-message-footer">
        {message.attemptNumber > 0 ? <span>{t("activityMessenger.attempt", { count: message.attemptNumber })}</span> : null}
        <time dateTime={message.createdAt}>{new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</time>
      </div>
    </article>)}
  </div>;
}

export function ActivityChatComposer({ onSend, broadcast = false }: { onSend: (body: string) => Promise<void>; broadcast?: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
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

export function mergeChatMessages<T extends { id: string; createdAt: string }>(old: T[], incoming: T[]) {
  return [...new Map([...old, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
