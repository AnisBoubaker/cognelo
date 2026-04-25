"use client";

import { useEffect, useMemo, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { normalizeMonacoLanguage } from "./code-language";

let hasRegisteredCogneloTheme = false;

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
  readOnlySuffix = ""
}: MonacoCodeEditorProps) {
  const editorLanguage = useMemo(() => normalizeMonacoLanguage(language), [language]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const displayedValue = `${readOnlyPrefix}${value}${readOnlySuffix}`;
  const hasRestrictedEditableRegion = !readOnly && (readOnlyPrefix.length > 0 || readOnlySuffix.length > 0);
  const displayedValueRef = useRef(displayedValue);
  const editableOffsetsRef = useRef(getEditableOffsets(displayedValue, readOnlyPrefix, readOnlySuffix));

  displayedValueRef.current = displayedValue;
  editableOffsetsRef.current = getEditableOffsets(displayedValue, readOnlyPrefix, readOnlySuffix);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) {
      return;
    }

    if (!hasRestrictedEditableRegion) {
      decorationIdsRef.current = model.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const editableOffsets = editableOffsetsRef.current;
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

    decorationIdsRef.current = model.deltaDecorations(decorationIdsRef.current, nextDecorations);
  }, [displayedValue, hasRestrictedEditableRegion, readOnlyPrefix, readOnlySuffix]);

  return (
    <div
      className="monaco-code-editor"
      style={{
        background: "rgba(248, 251, 255, 0.94)",
        border: "1px solid color-mix(in srgb, var(--brand-blue), white 72%)",
        borderRadius: 8,
        height,
        minHeight,
        overflow: "hidden"
      }}
    >
      <Editor
        beforeMount={configureMonaco}
        onMount={handleEditorMount}
        defaultLanguage={editorLanguage}
        height={height ?? minHeight}
        language={editorLanguage}
        onChange={(nextValue) => {
          const nextText = nextValue ?? "";

          if (readOnly || (!readOnlyPrefix && !readOnlySuffix)) {
            onChange(nextText);
            return;
          }

          if (!nextText.startsWith(readOnlyPrefix) || !nextText.endsWith(readOnlySuffix)) {
            const editor = editorRef.current;
            const model = editor?.getModel();
            if (editor && model && model.getValue() !== displayedValue) {
              model.setValue(displayedValue);
              const editableOffsets = getEditableOffsets(displayedValue, readOnlyPrefix, readOnlySuffix);
              const nextPosition = model.getPositionAt(editableOffsets.endOffset);
              if (nextPosition) {
                editor.setPosition(nextPosition);
              }
            }
            return;
          }

          onChange(nextText.slice(readOnlyPrefix.length, nextText.length - readOnlySuffix.length));
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
        path={id}
        theme="cognelo-light"
        value={displayedValue}
      />
    </div>
  );

  function handleEditorMount(editor: Parameters<OnMount>[0], monaco: Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (!hasRestrictedEditableRegion) {
      return;
    }

    const editableOffsets = editableOffsetsRef.current;
    const editableRange = getMonacoRangeFromOffsets(
      monaco,
      displayedValueRef.current,
      editableOffsets.startOffset,
      editableOffsets.endOffset
    );
    if (editableRange) {
      editor.setPosition(editableRange.getStartPosition());
    }

    editor.onDidChangeCursorSelection((event) => {
      if (!event.selection.isEmpty()) {
        return;
      }

      const model = editor.getModel();
      if (!model) {
        return;
      }

      const offset = model.getOffsetAt(event.selection.getPosition());
      const currentEditableOffsets = editableOffsetsRef.current;
      if (offset >= currentEditableOffsets.startOffset && offset <= currentEditableOffsets.endOffset) {
        return;
      }

      const clampedOffset =
        offset < currentEditableOffsets.startOffset ? currentEditableOffsets.startOffset : currentEditableOffsets.endOffset;
      const nextPosition = model.getPositionAt(clampedOffset);
      editor.setPosition(nextPosition);
    });
  }
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

function getEditableMonacoRange(monaco: Monaco | null, displayedValue: string, readOnlyPrefix: string, studentValue: string) {
  if (!monaco) {
    return null;
  }

  const startOffset = readOnlyPrefix.length;
  const endOffset = readOnlyPrefix.length + studentValue.length;
  const startPosition = getPositionFromOffset(displayedValue, startOffset);
  const endPosition = getPositionFromOffset(displayedValue, endOffset);

  return new monaco.Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);
}

function getPositionFromOffset(value: string, offset: number) {
  const beforeOffset = value.slice(0, offset);
  const lines = beforeOffset.split("\n");
  return {
    lineNumber: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  };
}

function getEditableOffsets(displayedValue: string, readOnlyPrefix: string, readOnlySuffix: string) {
  return {
    startOffset: readOnlyPrefix.length,
    endOffset: displayedValue.length - readOnlySuffix.length
  };
}

function getMonacoRangeFromOffsets(monaco: Monaco | null, value: string, startOffset: number, endOffset: number) {
  if (!monaco || startOffset === endOffset) {
    return null;
  }

  const start = getPositionFromOffset(value, startOffset);
  const end = getPositionFromOffset(value, endOffset);
  return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}
