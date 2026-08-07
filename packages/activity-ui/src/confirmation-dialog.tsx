"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

export type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  eyebrow?: string;
  confirmVariant?: "default" | "danger";
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmationDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  eyebrow,
  confirmVariant = "default",
  isConfirming = false,
  onCancel,
  onConfirm
}: ConfirmationDialogProps) {
  const titleId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isConfirming) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isConfirming, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) {
          onCancel();
        }
      }}
    >
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-panel stack" role="dialog">
        <div className="stack" style={{ gap: 8 }}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id={titleId}>{title}</h2>
          <div className="muted">{message}</div>
        </div>
        <div className="dialog-actions">
          <button className="secondary" disabled={isConfirming} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            className={confirmVariant === "danger" ? "danger" : undefined}
            disabled={isConfirming}
            type="button"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
