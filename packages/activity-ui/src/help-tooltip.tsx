"use client";
import React, { Children, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionIcon } from "./action-icon";

type HelpContextValue = { locale: string; activeId: string | null; setActiveId: (id: string | null) => void };
const HelpContext = createContext<HelpContextValue | null>(null);
export function HelpProvider({ children, locale = "en" }: { children: ReactNode; locale?: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const value = useMemo(() => ({ locale, activeId, setActiveId }), [locale, activeId]);
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}
export function helpLabelText(value: ReactNode): string {
  return Children.toArray(value).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (!isValidElement<{ children?: ReactNode; "aria-hidden"?: boolean | string }>(child) || child.props["aria-hidden"] === true || child.props["aria-hidden"] === "true" || typeof child.type === "string" && ["input", "select", "textarea", "button"].includes(child.type)) return "";
    return helpLabelText(child.props.children);
  }).join(" ").replace(/\s+/g, " ").trim();
}
export function calculateHelpPosition(anchor: { left: number; right: number; top: number; bottom: number }, width: number, height: number, viewportWidth: number, viewportHeight: number, rtl = false) {
  const margin = 12, gap = 8;
  const left = Math.max(margin, Math.min(rtl ? anchor.right - width : anchor.left, viewportWidth - width - margin));
  const below = anchor.bottom + gap, above = anchor.top - height - gap;
  const top = below + height <= viewportHeight - margin ? below : above >= margin ? above : Math.max(margin, viewportHeight - height - margin);
  return { left, top };
}
/** Static explanatory copy, available by hover/focus and pinnable on touch. */
export function HelpTooltip({ content, label, locale: requestedLocale }: { content: ReactNode; label?: ReactNode; locale?: string }) {
  const context = useContext(HelpContext), [localId, setLocalId] = useState<string | null>(null), id = useId();
  const locale = requestedLocale ?? context?.locale ?? "en", help = ({ en: "Help", fr: "Aide", zh: "帮助", ar: "مساعدة" } as Record<string, string>)[locale] ?? "Help";
  const activeId = context?.activeId ?? localId, setActiveId = context?.setActiveId ?? setLocalId, open = activeId === id;
  const trigger = useRef<HTMLButtonElement | null>(null), panel = useRef<HTMLDivElement | null>(null), closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null), pinned = useRef(false), dismissed = useRef(false);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  const clearClose = useCallback(() => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } }, []);
  const close = useCallback(() => { clearClose(); pinned.current = false; dismissed.current = true; if (open) setActiveId(null); }, [clearClose, setActiveId, open]);
  const show = () => { clearClose(); if (!dismissed.current) setActiveId(id); };
  const scheduleClose = () => { if (!open) return; clearClose(); if (!pinned.current && document.activeElement !== trigger.current) closeTimer.current = setTimeout(close, 140); };
  useEffect(() => { if (!open) { pinned.current = false; clearClose(); } }, [open, clearClose]);
  useEffect(() => clearClose, [clearClose]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const rect = trigger.current.getBoundingClientRect(), width = Math.min(360, window.innerWidth - 24);
      const point = calculateHelpPosition(rect, width, panel.current.offsetHeight, window.innerWidth, window.innerHeight, document.documentElement.dir === "rtl");
      setPosition({ ...point, width, visibility: "visible" });
    };
    place(); window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (panel.current) observer?.observe(panel.current);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); observer?.disconnect(); };
  }, [open, content]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
  }, [open, close]);
  const title = helpLabelText(label);
  return <>
    <button type="button" className="help-tooltip-trigger" aria-label={title ? `${help}: ${title}` : help} aria-describedby={open ? `${id}-content` : undefined} aria-expanded={open}
      ref={trigger} onMouseEnter={show} onMouseLeave={() => { dismissed.current = false; scheduleClose(); }} onFocus={() => { dismissed.current = false; show(); }}
      onBlur={event => { if (!panel.current?.contains(event.relatedTarget as Node)) { pinned.current = false; close(); } }}
      onClick={event => { event.preventDefault(); event.stopPropagation(); clearClose(); if (pinned.current) close(); else { dismissed.current = false; pinned.current = true; setActiveId(id); } }}>
      <ActionIcon name="help" size={18} />
    </button>
    {open && typeof document !== "undefined" && createPortal(<div id={`${id}-content`} role="tooltip" ref={panel} className="help-tooltip-content" style={position}
      onMouseEnter={clearClose} onMouseLeave={scheduleClose} onFocus={clearClose} onBlur={event => { if (!panel.current?.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(); }}>{content}</div>, document.body)}
  </>;
}
/** Keeps the help button outside the heading/label's accessible name and form activation. */
export function HelpLabel({ children, help, label, locale, inline = false }: { children: ReactNode; help: ReactNode; label?: ReactNode; locale?: string; inline?: boolean }) {
  const Tag = inline ? "span" : "div";
  if (help === null || help === undefined || help === false) return <>{children}</>;
  return <Tag className="help-label">{children}<HelpTooltip content={help} label={label ?? children} locale={locale} /></Tag>;
}
