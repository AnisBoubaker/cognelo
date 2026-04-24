"use client";

import { useMemo } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
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
};

export function MonacoCodeEditor({
  value,
  onChange,
  language = "text",
  minHeight = 260,
  id,
  ariaLabel,
  readOnly = false
}: MonacoCodeEditorProps) {
  const editorLanguage = useMemo(() => normalizeMonacoLanguage(language), [language]);

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
        defaultLanguage={editorLanguage}
        height={minHeight}
        language={editorLanguage}
        onChange={(nextValue) => onChange(nextValue ?? "")}
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
        value={value}
      />
    </div>
  );
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
