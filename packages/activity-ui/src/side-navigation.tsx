"use client";
import { Fragment, type ReactNode } from "react";

export type SideNavigationItem = { id: string; label: string; text?: string; isActive: boolean; href?: string };
export const sideNavigationItemId = (prefix: string, itemId: string) => `${prefix}-${encodeURIComponent(itemId)}`;

/** The shared left navigation used by settings/course folders, also usable as in-page tabs. */
export function SideNavigation({ ariaLabel, items, renderLink, tabs }: {
  ariaLabel: string;
  items: SideNavigationItem[];
  renderLink?: (item: SideNavigationItem, children: ReactNode) => ReactNode;
  tabs?: { idPrefix: string; panelId: string; onSelect: (id: string) => void };
}) {
  return <aside className="settings-nav" aria-label={ariaLabel} role={tabs ? "tablist" : undefined} aria-orientation={tabs ? "vertical" : undefined}
    onKeyDown={tabs ? event => {
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      const current = buttons.indexOf(event.currentTarget.ownerDocument.activeElement as HTMLButtonElement);
      if (current < 0) return;
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      event.preventDefault(); buttons[next]?.focus(); buttons[next]?.click();
    } : undefined}>
    {items.map(item => {
      const content = <><span>{item.label}</span>{item.text && <small>{item.text}</small>}</>;
      return <Fragment key={item.id}>{tabs ? <button type="button" role="tab" id={sideNavigationItemId(tabs.idPrefix, item.id)} aria-controls={tabs.panelId}
        aria-selected={item.isActive} tabIndex={item.isActive ? 0 : -1} className={item.isActive ? "is-active" : undefined} onClick={() => tabs.onSelect(item.id)}>{content}</button>
        : renderLink ? renderLink(item, content) : <a href={item.href} aria-current={item.isActive ? "page" : undefined} className={item.isActive ? "is-active" : undefined}>{content}</a>}</Fragment>;
    })}
  </aside>;
}
