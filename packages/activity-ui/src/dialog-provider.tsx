"use client";

import {
  createContext,
  type HTMLInputTypeAttribute,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { ConfirmationDialog } from "./confirmation-dialog";

export type DialogLabels = {
  cancel: string;
  confirm: string;
  confirmTitle: string;
  promptTitle: string;
};

export type ConfirmDialogOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "danger";
  eyebrow?: string;
  message: ReactNode;
  title?: string;
};

export type PromptDialogOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  defaultValue?: string;
  eyebrow?: string;
  inputLabel: string;
  inputType?: HTMLInputTypeAttribute;
  maxLength?: number;
  message?: ReactNode;
  placeholder?: string;
  required?: boolean;
  title?: string;
};

type DialogRequest =
  | { kind: "confirm"; options: ConfirmDialogOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; options: PromptDialogOptions; resolve: (value: string | null) => void };

type DialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  prompt: (options: PromptDialogOptions) => Promise<string | null>;
};

const unavailable = async () => {
  throw new Error("DialogProvider is required before requesting a shared dialog.");
};

const DialogContext = createContext<DialogContextValue>({
  confirm: unavailable,
  prompt: unavailable
});

function cancelledValue(request: DialogRequest) {
  return request.kind === "confirm" ? false : null;
}

export function DialogProvider({ children, labels }: { children: ReactNode; labels: DialogLabels }) {
  const inputId = useId();
  const [active, setActive] = useState<DialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const activeRef = useRef<DialogRequest | null>(null);
  const queueRef = useRef<DialogRequest[]>([]);

  const activate = useCallback((request: DialogRequest) => {
    if (activeRef.current) {
      queueRef.current.push(request);
      return;
    }
    activeRef.current = request;
    setPromptValue(request.kind === "prompt" ? request.options.defaultValue ?? "" : "");
    setActive(request);
  }, []);

  const finish = useCallback((value: boolean | string | null) => {
    const current = activeRef.current;
    if (!current) return;
    if (current.kind === "confirm") current.resolve(value === true);
    else current.resolve(typeof value === "string" ? value : null);

    const next = queueRef.current.shift() ?? null;
    activeRef.current = next;
    setPromptValue(next?.kind === "prompt" ? next.options.defaultValue ?? "" : "");
    setActive(next);
  }, []);

  useEffect(() => () => {
    const pending = [activeRef.current, ...queueRef.current].filter((request): request is DialogRequest => Boolean(request));
    activeRef.current = null;
    queueRef.current = [];
    for (const request of pending) {
      if (request.kind === "confirm") request.resolve(false);
      else request.resolve(null);
    }
  }, []);

  const context = useMemo<DialogContextValue>(() => ({
    confirm: (options) => new Promise<boolean>((resolve) => activate({ kind: "confirm", options, resolve })),
    prompt: (options) => new Promise<string | null>((resolve) => activate({ kind: "prompt", options, resolve }))
  }), [activate]);

  const promptOptions = active?.kind === "prompt" ? active.options : null;
  const promptInvalid = Boolean(promptOptions?.required && !promptValue.trim());

  return (
    <DialogContext.Provider value={context}>
      {children}
      <ConfirmationDialog
        open={Boolean(active)}
        eyebrow={active?.options.eyebrow}
        title={active?.options.title ?? (active?.kind === "prompt" ? labels.promptTitle : labels.confirmTitle)}
        message={active?.kind === "prompt" ? (
          <div className="stack">
            {active.options.message ? <div>{active.options.message}</div> : null}
            <div className="field">
              <label htmlFor={inputId}>{active.options.inputLabel}</label>
              <input
                id={inputId}
                autoFocus
                maxLength={active.options.maxLength}
                placeholder={active.options.placeholder}
                required={active.options.required}
                type={active.options.inputType ?? "text"}
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !promptInvalid) {
                    event.preventDefault();
                    finish(promptValue);
                  }
                }}
              />
            </div>
          </div>
        ) : active?.options.message ?? null}
        confirmLabel={active?.options.confirmLabel ?? labels.confirm}
        cancelLabel={active?.options.cancelLabel ?? labels.cancel}
        confirmVariant={active?.kind === "confirm" ? active.options.confirmVariant : "default"}
        confirmDisabled={promptInvalid}
        onCancel={() => finish(active ? cancelledValue(active) : null)}
        onConfirm={() => finish(active?.kind === "prompt" ? promptValue : true)}
      />
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  return useContext(DialogContext);
}
