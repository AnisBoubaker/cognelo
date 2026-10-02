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
  confirmDisabled?: boolean;
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
  confirmDisabled = false,
  isConfirming = false,
  onCancel,
  onConfirm
}: ConfirmationDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isConfirmingRef = useRef(isConfirming);
  const onCancelRef = useRef(onCancel);

  isConfirmingRef.current = isConfirming;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) {
      return;
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialogRef.current?.contains(document.activeElement)) {
      confirmButtonRef.current?.focus();
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isConfirmingRef.current) {
        onCancelRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

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
      <section ref={dialogRef} aria-labelledby={titleId} aria-modal="true" className="dialog-panel stack" role="dialog">
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
            disabled={isConfirming || confirmDisabled}
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
