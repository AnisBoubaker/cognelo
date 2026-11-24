"use client";

import React, { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ContextMenuPoint = { x: number; y: number };
export type ContextMenuRect = { bottom: number; left: number; right: number; top: number };

export function calculateContextMenuPosition(input: {
  anchorRect?: ContextMenuRect;
  menuHeight: number;
  menuWidth: number;
  point?: ContextMenuPoint;
  viewportHeight: number;
  viewportWidth: number;
}) {
  const margin = 8;
  const gap = 4;
  const left = input.anchorRect ? input.anchorRect.right - input.menuWidth : input.point?.x ?? margin;
  let top = input.anchorRect ? input.anchorRect.bottom + gap : input.point?.y ?? margin;
  if (top + input.menuHeight > input.viewportHeight - margin) {
    top = input.anchorRect ? input.anchorRect.top - input.menuHeight - gap : top - input.menuHeight;
  }
  return {
    left: Math.max(margin, Math.min(left, input.viewportWidth - input.menuWidth - margin)),
    top: Math.max(margin, Math.min(top, input.viewportHeight - input.menuHeight - margin))
  };
}

export function ContextMenu({
  anchor,
  ariaLabel,
  children,
  className,
  onClose,
  open,
  point
}: {
  anchor?: HTMLElement | null;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
  open: boolean;
  point?: ContextMenuPoint | null;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ left: 0, top: 0, visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || (!anchor && !point)) return;
    const menu = menuRef.current;
    if (!menu) return;
    const anchorRect = anchor?.getBoundingClientRect();
    const { left, top } = calculateContextMenuPosition({
      anchorRect: anchorRect ? { bottom: anchorRect.bottom, left: anchorRect.left, right: anchorRect.right, top: anchorRect.top } : undefined,
      menuHeight: menu.offsetHeight,
      menuWidth: menu.offsetWidth,
      point: point ?? undefined,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    });
    setStyle({ left, top, visibility: "visible" });
  }, [anchor, children, open, point]);

  useLayoutEffect(() => {
    if (!open) return;
    // Scroll events can be delivered after a click has opened the menu, even
    // though the scrolling itself finished before the menu was positioned.
    // Remember current offsets so that only subsequent movement dismisses it.
    const scrollOffsets = new WeakMap<Element, { left: number; top: number }>();
    function rememberScroll(element: Element | null) {
      if (element) scrollOffsets.set(element, { left: element.scrollLeft, top: element.scrollTop });
    }
    for (let element: Element | null = anchor ?? null; element; element = element.parentElement) rememberScroll(element);
    rememberScroll(document.scrollingElement);
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !anchor?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function handleScroll(event: Event) {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      const element = event.target === document || event.target === window ? document.scrollingElement : event.target;
      if (element instanceof Element) {
        const previous = scrollOffsets.get(element);
        if (previous && previous.left === element.scrollLeft && previous.top === element.scrollTop) return;
      }
      onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [anchor, onClose, open]);

  if (!open || typeof document === "undefined" || (!anchor && !point)) return null;
  return createPortal(
    <div aria-label={ariaLabel} className={className} ref={menuRef} role="menu" style={{ ...style, bottom: "auto", position: "fixed", right: "auto", zIndex: 1000 }}>
      {children}
    </div>,
    document.body
  );
}
