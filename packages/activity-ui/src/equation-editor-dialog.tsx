"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MathfieldElement, VirtualKeyboardInterface } from "mathlive";

export type EquationEditorCopy = {
  eyebrow: string;
  addTitle: string;
  editTitle: string;
  help: string;
  inputLabel: string;
  styleLabel: string;
  inline: string;
  display: string;
  shortcuts: string;
  keyboard: string;
  loading: string;
  loadError: string;
  required: string;
  incomplete: string;
  cancel: string;
  insert: string;
  update: string;
  remove: string;
  close: string;
};

export type EquationEditorDialogProps = {
  copy: EquationEditorCopy;
  displayMode: boolean;
  initialLatex: string;
  locale: string;
  mode: "add" | "edit";
  onCancel: () => void;
  onConfirm: (value: { displayMode: boolean; latex: string }) => void;
  onRemove?: () => void;
};

const equationShortcuts = [
  { label: "a⁄b", latex: "\\frac{#0}{#?}" },
  { label: "√", latex: "\\sqrt{#0}" },
  { label: "x²", latex: "#@^{#?}" },
  { label: "xₙ", latex: "#@_{#?}" },
  { label: "(x)", latex: "\\left(#0\\right)" },
  { label: "|x|", latex: "\\left|#0\\right|" },
  { label: "π", latex: "\\pi" },
  { label: "±", latex: "\\pm" },
  { label: "×", latex: "\\times" },
  { label: "≤", latex: "\\le" },
  { label: "Σ", latex: "\\sum_{#0}^{#?}" },
  { label: "∫", latex: "\\int_{#0}^{#?} #? \\, d#?" }
] as const;

export function EquationEditorDialog({
  copy,
  displayMode: initialDisplayMode,
  initialLatex,
  locale,
  mode,
  onCancel,
  onConfirm,
  onRemove
}: EquationEditorDialogProps) {
  const [displayMode, setDisplayMode] = useState(initialDisplayMode);
  const [latex, setLatex] = useState(initialLatex);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [validationError, setValidationError] = useState("");
  const mathfieldHostRef = useRef<HTMLDivElement | null>(null);
  const keyboardHostRef = useRef<HTMLDivElement | null>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let keyboard: VirtualKeyboardInterface | null = null;
    let keyboardGeometryFrame: number | null = null;
    let keyboardPlateObserver: ResizeObserver | null = null;

    function syncKeyboardHostHeight() {
      if (keyboardGeometryFrame !== null) {
        cancelAnimationFrame(keyboardGeometryFrame);
      }
      keyboardGeometryFrame = requestAnimationFrame(() => {
        keyboardGeometryFrame = null;
        const keyboardHost = keyboardHostRef.current;
        const keyboardHeight = keyboard?.boundingRect.height ?? 0;
        if (keyboardHost && keyboardHeight > 0) {
          keyboardHost.style.height = `${Math.ceil(keyboardHeight)}px`;
        }
      });
    }

    void import("mathlive")
      .then(({ MathfieldElement }) => {
        if (disposed || !mathfieldHostRef.current || !keyboardHostRef.current) {
          return;
        }

        MathfieldElement.fontsDirectory = null;
        MathfieldElement.soundsDirectory = null;
        MathfieldElement.computeEngine = null;
        MathfieldElement.locale = locale;

        const mathfield = new MathfieldElement();
        mathfield.className = "equation-editor-mathfield";
        mathfield.mathVirtualKeyboardPolicy = "manual";
        mathfield.smartFence = true;
        mathfield.setAttribute("aria-label", copy.inputLabel);
        mathfield.setValue(initialLatex);
        mathfield.addEventListener("input", () => {
          setLatex(mathfield.getValue());
          setValidationError("");
        });
        mathfieldHostRef.current.replaceChildren(mathfield);
        mathfieldRef.current = mathfield;

        keyboard = window.mathVirtualKeyboard;
        keyboard.container = keyboardHostRef.current;
        keyboard.layouts = ["compact", "symbols", "greek"];
        keyboard.show({ animate: false });
        const keyboardPlate = keyboardHostRef.current.querySelector(".MLK__plate");
        if (keyboardPlate) {
          keyboardPlateObserver = new ResizeObserver(syncKeyboardHostHeight);
          keyboardPlateObserver.observe(keyboardPlate);
        }
        syncKeyboardHostHeight();
        mathfield.focus();
        setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setLoading(false);
          setLoadError(true);
        }
      });

    return () => {
      disposed = true;
      mathfieldRef.current = null;
      if (keyboardGeometryFrame !== null) {
        cancelAnimationFrame(keyboardGeometryFrame);
      }
      keyboardPlateObserver?.disconnect();
      if (keyboard) {
        keyboard.hide({ animate: false });
        keyboard.container = document.body;
        keyboard.layouts = "default";
      }
    };
  }, [copy.inputLabel, initialLatex, locale]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  function insertShortcut(fragment: string) {
    const mathfield = mathfieldRef.current;
    if (!mathfield) {
      return;
    }
    mathfield.insert(fragment, { focus: true, selectionMode: "placeholder" });
    setLatex(mathfield.getValue());
    setValidationError("");
  }

  function confirm() {
    const normalizedLatex = latex.trim();
    if (!normalizedLatex) {
      setValidationError(copy.required);
      return;
    }
    if (/\\placeholder\{\}/.test(normalizedLatex)) {
      setValidationError(copy.incomplete);
      return;
    }
    onConfirm({ displayMode, latex: normalizedLatex });
  }

  return createPortal(
    <div className="dialog-backdrop equation-editor-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        aria-labelledby="equation-editor-title"
        aria-modal="true"
        className="dialog-panel equation-editor-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="section-heading equation-editor-heading">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 id="equation-editor-title">{mode === "edit" ? copy.editTitle : copy.addTitle}</h2>
            <p className="muted">{copy.help}</p>
          </div>
          <button aria-label={copy.close} className="secondary icon-button" type="button" onClick={onCancel}>×</button>
        </div>

        <div aria-label={copy.styleLabel} className="equation-editor-style" role="group">
          <button aria-pressed={!displayMode} className={!displayMode ? "is-active" : ""} type="button" onClick={() => setDisplayMode(false)}>
            {copy.inline}
          </button>
          <button aria-pressed={displayMode} className={displayMode ? "is-active" : ""} type="button" onClick={() => setDisplayMode(true)}>
            {copy.display}
          </button>
        </div>

        <div className="field equation-editor-field">
          <span className="field-label">{copy.inputLabel}</span>
          {loading ? <p className="muted">{copy.loading}</p> : null}
          {loadError ? <p className="error" role="alert">{copy.loadError}</p> : null}
          <div className="equation-editor-mathfield-host" ref={mathfieldHostRef} />
        </div>

        <div className="equation-editor-section">
          <p className="field-label">{copy.shortcuts}</p>
          <div className="equation-editor-shortcuts" role="toolbar" aria-label={copy.shortcuts}>
            {equationShortcuts.map((shortcut) => (
              <button
                aria-label={shortcut.label}
                disabled={loading || loadError}
                key={shortcut.label}
                title={shortcut.label}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertShortcut(shortcut.latex)}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
        </div>

        <div className="equation-editor-section">
          <p className="field-label">{copy.keyboard}</p>
          <div className="equation-editor-keyboard-host" ref={keyboardHostRef} />
        </div>

        {validationError ? <p className="error" role="alert">{validationError}</p> : null}

        <div className="dialog-actions equation-editor-actions">
          {mode === "edit" && onRemove ? <button className="danger secondary" type="button" onClick={onRemove}>{copy.remove}</button> : null}
          <span className="equation-editor-action-spacer" />
          <button className="secondary" type="button" onClick={onCancel}>{copy.cancel}</button>
          <button disabled={loading || loadError} type="button" onClick={confirm}>{mode === "edit" ? copy.update : copy.insert}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
