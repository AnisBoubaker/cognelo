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
  let left = input.anchorRect ? input.anchorRect.right - input.menuWidth : input.point?.x ?? margin;
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
  children,
  className,
  onClose,
  open,
  point
}: {
  anchor?: HTMLElement | null;
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
  }, [anchor, open, point]);

  useLayoutEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node) && !anchor?.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [anchor, onClose, open]);

  if (!open || typeof document === "undefined" || (!anchor && !point)) return null;
  return createPortal(
    <div className={className} ref={menuRef} role="menu" style={{ ...style, bottom: "auto", position: "fixed", right: "auto", zIndex: 1000 }}>
      {children}
    </div>,
    document.body
  );
}
