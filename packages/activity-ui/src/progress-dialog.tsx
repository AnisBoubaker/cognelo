"use client";

import { DialogHeader } from "./dialog-header";

import { useSharedDialogOpen } from "./dialog-provider";
import { useBodyScrollLock } from "./body-scroll-lock";

import React, { type ReactNode, useEffect, useId, useRef } from "react";

export type ProgressDialogStatus = "running" | "success" | "error";

export type ProgressDialogProps = {
  open: boolean;
  title: string;
  progressLabel: string;
  eyebrow?: string;
  message?: ReactNode;
  progress?: number | null;
  progressSummary?: ReactNode;
  status?: ProgressDialogStatus;
  error?: ReactNode;
  closeLabel?: string;
  onClose?: () => void;
};

export function ProgressDialog({
  open: requestedOpen,
  title,
  progressLabel,
  eyebrow,
  message,
  progress,
  progressSummary,
  status = "running",
  error,
  closeLabel,
  onClose
}: ProgressDialogProps) {
  const titleId = useId();
  const sharedDialogOpen = useSharedDialogOpen();
  const open = requestedOpen && !sharedDialogOpen;
  const messageId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const statusRef = useRef(status);
  const onCloseRef = useRef(onClose);
  const canClose = status !== "running" && Boolean(onClose && closeLabel);
  const normalizedProgress = typeof progress === "number"
    ? Math.max(0, Math.min(100, progress))
    : null;

  statusRef.current = status;
  onCloseRef.current = onClose;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && statusRef.current === "running") {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      if (event.key !== "Escape") return;
      if (statusRef.current === "running") {
        event.preventDefault();
        return;
      }
      onCloseRef.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && canClose) closeButtonRef.current?.focus();
  }, [canClose, open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop progress-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        aria-busy={status === "running"}
        aria-describedby={message ? messageId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog-panel progress-dialog stack"
        role="dialog"
        tabIndex={-1}
      >
        <DialogHeader closeLabel={closeLabel ?? title} onClose={canClose ? onClose : undefined} closeButtonRef={closeButtonRef}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id={titleId}>{title}</h2>
        </DialogHeader>
        {message ? <div className="muted" id={messageId}>{message}</div> : null}
        <div aria-live="polite" className="progress-dialog-body" role="status">
          <progress
            aria-label={progressLabel}
            max={100}
            {...(normalizedProgress === null ? {} : { value: normalizedProgress })}
          />
          <div className="progress-dialog-summary">
            {normalizedProgress === null ? <span>{progressLabel}</span> : <span>{Math.round(normalizedProgress)}%</span>}
            {progressSummary ? <span>{progressSummary}</span> : null}
          </div>
          {error ? <div className="error">{error}</div> : null}
        </div>
      </section>
    </div>
  );
}
