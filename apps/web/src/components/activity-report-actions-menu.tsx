"use client";
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ContextMenu, type ActionIconName } from "@cognelo/activity-ui";
import { AppIcon } from "./app-icon";

export type ActivityReportMenuAction = {
  id: string; label: string; icon: ActionIconName; disabled?: boolean; danger?: boolean;
  href?: string; onSelect?: () => void; badge?: number;
};
export function ActivityReportActionsMenu({ label, actions, unreadCount = 0, describedBy }: {
  label: string; actions: ActivityReportMenuAction[]; unreadCount?: number; describedBy?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null), content = useRef<HTMLDivElement | null>(null), focusLast = useRef(false);
  const close = useCallback(() => { setAnchor(null); trigger.current?.focus(); }, []);
  const enabledItems = () => [...(content.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])') ?? [])];
  useLayoutEffect(() => {
    if (!anchor) return;
    const frame = requestAnimationFrame(() => {
      const items = enabledItems();
      (focusLast.current ? items.at(-1) : items[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor]);
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    const items = enabledItems(), index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== null) { event.preventDefault(); items[next]?.focus(); }
    if (event.key === "Tab") close();
    if (event.key === " " && document.activeElement?.tagName === "A") { event.preventDefault(); (document.activeElement as HTMLElement).click(); }
  }
  return <>
    <button ref={trigger} className={`button secondary icon-button activity-report-menu-trigger${unreadCount ? " has-unread" : ""}`} type="button"
      aria-label={label} title={label} aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-describedby={describedBy}
      onClick={event => { focusLast.current = false; setAnchor(anchor ? null : event.currentTarget); }}
      onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); focusLast.current = event.key === "ArrowUp"; setAnchor(event.currentTarget); } }}>
      <AppIcon name="more" />
      {unreadCount > 0 && <span className="activity-message-count" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    <ContextMenu anchor={anchor} ariaLabel={label} className="content-context-menu activity-report-context-menu" open={Boolean(anchor)} onClose={close}>
      <div ref={content} role="none" onKeyDown={navigate}>
        {actions.map(action => {
          const className = `content-context-menu-item${action.danger ? " is-danger" : ""}`;
          const children = <><AppIcon name={action.icon} /><span>{action.label}{Boolean(action.badge) && <span className="activity-message-count" aria-hidden="true">{action.badge! > 99 ? "99+" : action.badge}</span>}</span></>;
          return action.href && !action.disabled
            ? <Link role="menuitem" className={className} href={action.href} key={action.id} onClick={() => setAnchor(null)}>{children}</Link>
            : <button role="menuitem" type="button" className={className} key={action.id} disabled={action.disabled}
              onClick={() => { setAnchor(null); action.onSelect?.(); }}>{children}</button>;
        })}
      </div>
    </ContextMenu>
  </>;
}
