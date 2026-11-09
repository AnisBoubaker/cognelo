"use client";
import { ActionIcon } from "./action-icon";
import { Fragment, type ReactNode } from "react";

export type SideNavigationItem = { id: string; label: string; text?: string; isActive: boolean; href?: string;
  selection?: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void };
  action?: { label: string; disabled?: boolean; onClick: () => void } };
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
      const tab = tabs ? <button type="button" role="tab" id={sideNavigationItemId(tabs.idPrefix, item.id)} aria-controls={tabs.panelId}
        aria-selected={item.isActive} tabIndex={item.isActive ? 0 : -1} className={item.isActive ? "is-active" : undefined} onClick={() => tabs.onSelect(item.id)}>{content}</button> : null;
      return <Fragment key={item.id}>{tabs ? item.action || item.selection ? <div className={`side-navigation-tab-with-action${item.selection ? " side-navigation-tab-with-selection" : ""}`}>
        {item.selection && <input type="checkbox" aria-label={item.selection.label} checked={item.selection.checked} disabled={item.selection.disabled} onChange={event => item.selection?.onChange(event.currentTarget.checked)} />}
        {tab}{item.action && <button type="button" className="side-navigation-tab-action icon-button" aria-label={item.action.label} title={item.action.label}
          disabled={item.action.disabled} tabIndex={item.isActive ? 0 : -1} onClick={item.action.onClick}><ActionIcon name="close" /></button>
        }</div> : tab
        : renderLink ? renderLink(item, content) : <a href={item.href} aria-current={item.isActive ? "page" : undefined} className={item.isActive ? "is-active" : undefined}>{content}</a>}</Fragment>;
    })}
  </aside>;
}
