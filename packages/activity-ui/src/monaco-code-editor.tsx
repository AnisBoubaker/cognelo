"use client";

import { useMemo, useRef } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { normalizeMonacoLanguage } from "./code-language";

let hasRegisteredCogneloTheme = false;

type MonacoCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  minHeight?: number;
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
  id,
  ariaLabel,
  readOnly = false,
  readOnlyPrefix = "",
  readOnlySuffix = ""
}: MonacoCodeEditorProps) {
  const editorLanguage = useMemo(() => normalizeMonacoLanguage(language), [language]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const displayedValue = `${readOnlyPrefix}${value}${readOnlySuffix}`;

  return (
    <div
      className="monaco-code-editor"
      style={{
        background: "rgba(248, 251, 255, 0.94)",
        border: "1px solid color-mix(in srgb, var(--brand-blue), white 72%)",
        borderRadius: 8,
        minHeight,
        overflow: "hidden"
      }}
    >
      <Editor
        beforeMount={configureMonaco}
        onMount={handleEditorMount}
        defaultLanguage={editorLanguage}
        height={minHeight}
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
              const editableRange = getEditableMonacoRange(monacoRef.current, displayedValue, readOnlyPrefix, value);
              if (editableRange) {
                editor.setSelection(editableRange);
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
