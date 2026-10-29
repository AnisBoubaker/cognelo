"use client";

import React, { createContext, useContext, type ReactNode, type Ref } from "react";
import { ActionIcon } from "./action-icon";

const DialogCloseLabelContext = createContext("Close");

export function DialogCloseLabelProvider({ children, label }: { children?: ReactNode; label: string }) {
  return <DialogCloseLabelContext.Provider value={label}>{children}</DialogCloseLabelContext.Provider>;
}

export function useDialogCloseLabel() { return useContext(DialogCloseLabelContext); }

export function getDialogCloseLabel(locale = "en") {
  if (locale === "fr") return "Fermer";
  if (locale === "zh") return "关闭";
  if (locale === "ar") return "إغلاق";
  return "Close";
}

export function DialogCloseButton({ label, onClose, disabled = false, buttonRef, autoFocus = false }: {
  label: string;
  onClose: () => void | Promise<void>;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  autoFocus?: boolean;
}) {
  return (
    <button ref={buttonRef} className="secondary icon-button dialog-close-button" type="button"
      aria-label={label} title={label} disabled={disabled} autoFocus={autoFocus} onClick={() => void onClose()}>
      <ActionIcon name="close" />
    </button>
  );
}

/** Keep dismissal beside the heading while the dialog's content scrolls. */
export function DialogHeader({ children, actions, closeLabel, onClose, closeDisabled = false, closeButtonRef, autoFocusClose = false, className = "" }: {
  children?: ReactNode;
  actions?: ReactNode;
  closeLabel: string;
  onClose?: () => void | Promise<void>;
  closeDisabled?: boolean;
  closeButtonRef?: Ref<HTMLButtonElement>;
  autoFocusClose?: boolean;
  className?: string;
}) {
  return (
    <header className={`dialog-header ${className}`}>
      <div className="dialog-header-content">{children}</div>
      {actions || onClose ? <div className="dialog-header-actions">
        {actions}
        {onClose ? <DialogCloseButton label={closeLabel} onClose={onClose} disabled={closeDisabled}
          buttonRef={closeButtonRef} autoFocus={autoFocusClose} /> : null}
      </div> : null}
    </header>
  );
}
