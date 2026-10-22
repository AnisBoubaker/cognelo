"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import { codeInputProtectionAttributes, protectCodeInput } from "./code-input-protection";
import { normalizeMonacoLanguage } from "./code-language";
import { useMonacoModelStore } from "./monaco-model-scope";
import {
  clampMonacoSelectionToEditableOffsets,
  getEditableMonacoOffsets,
  getEditableMonacoValue
} from "./monaco-code-editor-value";

let hasRegisteredCogneloTheme = false;
if (typeof window !== "undefined") {
  // Monaco bootstraps language workers from blob URLs. Their fetches cannot
  // resolve a root-relative asset path against that base. Use the site's
  // absolute origin (without any URL credentials) before initializing Monaco.
  loader.config({ paths: { vs: new URL("/_vendor/monaco/vs", window.location.origin).href } });
}

type MonacoCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  minHeight?: number;
  height?: number | string;
  id?: string;
  ariaLabel?: string;
  readOnly?: boolean;
  readOnlyPrefix?: string;
  readOnlySuffix?: string;
  loading?: boolean;
  loadingLabel?: string;
};

export function MonacoCodeEditor({
  value,
  onChange,
  language = "text",
  minHeight = 260,
  height,
  id,
  ariaLabel,
  readOnly = false,
  readOnlyPrefix = "",
  readOnlySuffix = "",
  loading = false,
  loadingLabel = "Loading editor…"
}: MonacoCodeEditorProps) {
  const editorLanguage = useMemo(() => normalizeMonacoLanguage(language), [language]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<ReturnType<Parameters<OnMount>[0]["createDecorationsCollection"]> | null>(null);
  const synchronizingRef = useRef(false);
  const fallbackId = useId();
  const { store, group } = useMonacoModelStore();
  const modelPath = store.path(group, id ?? fallbackId);
  const [monacoLoadState, setMonacoLoadState] = useState<"loading" | "ready" | "failed">(
    loader.__getMonacoInstance() ? "ready" : "loading"
  );
  const displayedValue = `${readOnlyPrefix}${value}${readOnlySuffix}`;
  const hasRestrictedEditableRegion = !readOnly && (readOnlyPrefix.length > 0 || readOnlySuffix.length > 0);
  const displayedValueRef = useRef(displayedValue);
  const readOnlyRegionRef = useRef({ readOnly, readOnlyPrefix, readOnlySuffix });

  displayedValueRef.current = displayedValue;
  readOnlyRegionRef.current = { readOnly, readOnlyPrefix, readOnlySuffix };

  useLayoutEffect(() => () => {
    // Runs before the child switches/disposes its editor. Keep cursor/scroll
    // state with the same ephemeral owner as the model, never in a global map.
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (editor && model) store.saveView(model.uri.toString(), editor.saveViewState());
  }, [loading, modelPath, store]);

  useEffect(() => {
    if (!loading && editorRef.current) synchronizeValue(editorRef.current);
  }, [displayedValue, loading, modelPath]);

  useEffect(() => {
    if (loader.__getMonacoInstance()) {
      setMonacoLoadState("ready");
      return;
    }
    let active = true;
    const initialization = loader.init();
    void initialization
      .then(() => {
        if (active) setMonacoLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!active || (error && typeof error === "object" && "type" in error && error.type === "cancelation")) return;
        console.warn("Monaco initialization failed; using the basic code editor.", error);
        setMonacoLoadState("failed");
      });
    return () => {
      active = false;
      initialization.cancel();
    };
  }, []);

  const updateDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) {
      return;
    }

    const { readOnly, readOnlyPrefix, readOnlySuffix } = readOnlyRegionRef.current;
    const displayedValue = model.getValue();
    if (readOnly || (!readOnlyPrefix && !readOnlySuffix)) {
      decorationsRef.current?.clear();
      return;
    }

    const editableOffsets = getEditableMonacoOffsets(displayedValue, readOnlyPrefix, readOnlySuffix);
    const prefixRange = editableOffsets.startOffset > 0 ? getMonacoRangeFromOffsets(monaco, displayedValue, 0, editableOffsets.startOffset) : null;
    const suffixRange =
      editableOffsets.endOffset < displayedValue.length
        ? getMonacoRangeFromOffsets(monaco, displayedValue, editableOffsets.endOffset, displayedValue.length)
        : null;

    const nextDecorations: Parameters<typeof model.deltaDecorations>[1] = [];
    if (prefixRange) {
      nextDecorations.push({
        range: prefixRange,
        options: {
          inlineClassName: "cognelo-monaco-readonly-inline",
          linesDecorationsClassName: "cognelo-monaco-readonly-gutter",
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
    }
    if (suffixRange) {
      nextDecorations.push({
        range: suffixRange,
        options: {
          inlineClassName: "cognelo-monaco-readonly-inline",
          linesDecorationsClassName: "cognelo-monaco-readonly-gutter",
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });
    }

    decorationsRef.current?.set(nextDecorations);
  }, []);

  useEffect(() => {
    updateDecorations();
  }, [displayedValue, hasRestrictedEditableRegion, readOnlyPrefix, readOnlySuffix, updateDecorations]);

  if (loading) return <div className="monaco-code-editor" role="status" style={editorContainerStyle(height, minHeight)}><span style={{ margin: "auto" }}>{loadingLabel}</span></div>;

  if (monacoLoadState === "failed") {
    return (
      <div className="monaco-code-editor notranslate" translate="no" style={editorContainerStyle(height, minHeight)}>
        <textarea
          {...codeInputProtectionAttributes}
          aria-label={ariaLabel}
          id={id}
          readOnly={readOnly}
          style={{
            background: "#f8fbff",
            border: 0,
            boxSizing: "border-box",
            color: "#17233f",
            fontFamily: '"SFMono-Regular", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace',
            fontSize: 14,
            height: "100%",
            minHeight,
            padding: 12,
            resize: "none",
            width: "100%"
          }}
          value={displayedValue}
          onChange={(event) => {
            const nextStudentValue = getEditableMonacoValue({
              nextValue: event.target.value,
              readOnly,
              readOnlyPrefix,
              readOnlySuffix
            });
            if (nextStudentValue !== null) onChange(nextStudentValue);
          }}
          onSelect={(event) => {
            if (!hasRestrictedEditableRegion) return;
            const textarea = event.currentTarget;
            const editableOffsets = getEditableMonacoOffsets(
              textarea.value,
              readOnlyPrefix,
              readOnlySuffix
            );
            const clampedSelection = clampMonacoSelectionToEditableOffsets(
              { startOffset: textarea.selectionStart, endOffset: textarea.selectionEnd },
              editableOffsets
            );
            if (
              clampedSelection.startOffset !== textarea.selectionStart ||
              clampedSelection.endOffset !== textarea.selectionEnd
            ) {
              textarea.setSelectionRange(clampedSelection.startOffset, clampedSelection.endOffset);
            }
          }}
        />
      </div>
    );
  }

  if (monacoLoadState === "loading") {
    return (
      <div className="monaco-code-editor notranslate" translate="no" role="status" style={editorContainerStyle(height, minHeight)}>
        <span style={{ margin: "auto" }}>{loadingLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="monaco-code-editor notranslate"
      translate="no"
      style={editorContainerStyle(height, minHeight)}
    >
      <Editor
        beforeMount={configureMonaco}
        onMount={handleEditorMount}
        defaultLanguage={editorLanguage}
        defaultValue={displayedValue}
        height={height ?? minHeight}
        language={editorLanguage}
        onChange={(nextValue) => {
          if (synchronizingRef.current) return;
          const nextStudentValue = getEditableMonacoValue({
            nextValue,
            readOnly,
            readOnlyPrefix,
            readOnlySuffix
          });
          if (nextStudentValue !== null) {
            onChange(nextStudentValue);
            return;
          }

          if (!readOnly) {
            const editor = editorRef.current;
            const model = editor?.getModel();
            if (editor && model && model.getValue() !== displayedValue) {
              synchronizeValue(editor);
              const editableOffsets = getEditableMonacoOffsets(displayedValue, readOnlyPrefix, readOnlySuffix);
              const nextPosition = model.getPositionAt(editableOffsets.endOffset);
              if (nextPosition) {
                editor.setPosition(nextPosition);
              }
            }
          }
        }}
        options={{
          ariaLabel,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          contextmenu: true,
          cursorBlinking: "smooth",
          fontFamily: '"SFMono-Regular", SFMono-Regular, ui-monospace, Menlo, Consolas, monospace',
          fontSize: 14,
          guides: {
            bracketPairs: true,
            indentation: true
          },
          lineDecorationsWidth: 10,
          lineNumbers: "on",
          minimap: { enabled: false },
          padding: {
            bottom: 12,
            top: 12
          },
          readOnly,
          roundedSelection: false,
          scrollBeyondLastLine: false,
          scrollbar: {
            alwaysConsumeMouseWheel: false
          },
          tabSize: 2,
          wordWrap: "on"
        }}
        path={modelPath}
        keepCurrentModel
        saveViewState={false}
        theme="cognelo-light"
      />
    </div>
  );

  function handleEditorMount(editor: Parameters<OnMount>[0], monaco: Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    let currentModel = editor.getModel();
    const attachModel = () => {
      currentModel = editor.getModel();
      if (currentModel) { store.remember(currentModel); currentModel.pushStackElement(); }
      synchronizeValue(editor);
      const view = currentModel && store.view(currentModel.uri.toString());
      if (view) editor.restoreViewState(view);
      updateDecorations();
    };
    decorationsRef.current = editor.createDecorationsCollection();
    attachModel();
    editor.onDidChangeModel(() => {
      if (currentModel && !currentModel.isDisposed()) currentModel.pushStackElement();
      attachModel();
    });
    editor.onDidDispose(() => {
      if (currentModel && !currentModel.isDisposed()) currentModel.pushStackElement();
      if (editorRef.current === editor) editorRef.current = null;
    });
    protectCodeInput(editor.getDomNode()?.querySelector("textarea") ?? null);

    if (hasRestrictedEditableRegion && !store.view(editor.getModel()!.uri.toString())) {
      const model = editor.getModel();
      const editableOffsets = getEditableMonacoOffsets(
        displayedValueRef.current,
        readOnlyPrefix,
        readOnlySuffix
      );
      if (model) {
        editor.setPosition(model.getPositionAt(editableOffsets.startOffset));
      }
    }

    editor.onDidChangeCursorSelection((event) => {
      const model = editor.getModel();
      if (!model) {
        return;
      }

      const currentRegion = readOnlyRegionRef.current;
      if (
        currentRegion.readOnly ||
        (!currentRegion.readOnlyPrefix && !currentRegion.readOnlySuffix)
      ) {
        return;
      }

      const editableOffsets = getEditableMonacoOffsets(
        model.getValue(),
        currentRegion.readOnlyPrefix,
        currentRegion.readOnlySuffix
      );
      const selectionStartOffset = model.getOffsetAt(event.selection.getStartPosition());
      const selectionEndOffset = model.getOffsetAt(event.selection.getEndPosition());
      const clampedSelection = clampMonacoSelectionToEditableOffsets(
        { startOffset: selectionStartOffset, endOffset: selectionEndOffset },
        editableOffsets
      );

      if (
        clampedSelection.startOffset === selectionStartOffset &&
        clampedSelection.endOffset === selectionEndOffset
      ) {
        return;
      }

      const nextSelection = getMonacoRangeFromOffsets(
        monaco,
        model.getValue(),
        clampedSelection.startOffset,
        clampedSelection.endOffset,
        true
      );
      if (nextSelection) {
        editor.setSelection(nextSelection);
      }
    });
  }

  function synchronizeValue(editor: Parameters<OnMount>[0]) {
    const model = editor.getModel();
    const desired = displayedValueRef.current;
    // Controlled-value echoes must leave typing/redo history intact, including
    // Monaco's platform-dependent EOL normalization. Genuine external values
    // (draft restoration, reset, changed scaffold) establish a fresh baseline.
    if (!model || model.getValue().replace(/\r\n?/g, "\n") === desired.replace(/\r\n?/g, "\n")) return;
    synchronizingRef.current = true;
    try { model.setValue(desired); }
    finally { synchronizingRef.current = false; }
  }
}

function editorContainerStyle(height: number | string | undefined, minHeight: number) {
  return {
    background: "rgba(248, 251, 255, 0.94)",
    border: "1px solid color-mix(in srgb, var(--brand-blue), white 72%)",
    borderRadius: 8,
    display: "flex",
    height,
    minHeight,
    overflow: "hidden"
  };
}

function configureMonaco(monaco: Monaco) {
  if (!hasRegisteredCogneloTheme) {
    monaco.editor.defineTheme("cognelo-light", {
      base: "vs",
      inherit: true,
      colors: {
        "editor.background": "#f8fbff",
        "editor.lineHighlightBackground": "#edf4ff",
        "editor.selectionBackground": "#cfe2ff",
        "editor.inactiveSelectionBackground": "#e7f0ff",
        "editorLineNumber.foreground": "#7e8ca6",
        "editorLineNumber.activeForeground": "#32446b"
      },
      rules: []
    });
    hasRegisteredCogneloTheme = true;
  }

  if (typeof document !== "undefined" && !document.getElementById("cognelo-monaco-readonly-style")) {
    const style = document.createElement("style");
    style.id = "cognelo-monaco-readonly-style";
    style.textContent = `
      .cognelo-monaco-readonly-inline {
        background: rgba(13, 27, 71, 0.085);
        border-radius: 3px;
      }
      .cognelo-monaco-readonly-gutter {
        border-left: 2px solid rgba(50, 68, 107, 0.28);
      }
    `;
    document.head.appendChild(style);
  }
  monaco.editor.setTheme("cognelo-light");
}

function getPositionFromOffset(value: string, offset: number) {
  const beforeOffset = value.slice(0, offset);
  const lines = beforeOffset.split("\n");
  return {
    lineNumber: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  };
}

function getMonacoRangeFromOffsets(
  monaco: Monaco | null,
  value: string,
  startOffset: number,
  endOffset: number,
  allowEmpty = false
) {
  if (!monaco || (!allowEmpty && startOffset === endOffset)) {
    return null;
  }

  const start = getPositionFromOffset(value, startOffset);
  const end = getPositionFromOffset(value, endOffset);
  return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}
