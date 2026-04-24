"use client";

import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { CodeRenderer } from "./code-renderer";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  id?: string;
  minHeight?: number;
  leftRail?: ReactNode;
  rightRail?: ReactNode;
  leftRailWidth?: number;
  rightRailWidth?: number;
  getLineClassName?: (lineIndex: number) => string | undefined;
};

export function CodeEditor({
  value,
  onChange,
  language = "text",
  id,
  minHeight = 220,
  leftRail,
  rightRail,
  leftRailWidth = 0,
  rightRailWidth = 0,
  getLineClassName
}: CodeEditorProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) {
      return;
    }

    const syncScroll = () => {
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    };

    syncScroll();
    textarea.addEventListener("scroll", syncScroll, { passive: true });
    return () => textarea.removeEventListener("scroll", syncScroll);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!container || !textarea || !overlay) {
      return;
    }

    textarea.style.height = "0px";
    const nextHeight = `${Math.max(minHeight, textarea.scrollHeight)}px`;
    textarea.style.height = nextHeight;
    overlay.style.height = nextHeight;
    container.style.height = nextHeight;
  }, [minHeight, value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const indent = "  ";

    if (event.shiftKey) {
      if (start === end) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const beforeCursor = value.slice(lineStart, start);
        const removable = beforeCursor.endsWith(indent) ? indent.length : beforeCursor.endsWith(" ") ? 1 : 0;
        if (!removable) {
          return;
        }

        const nextValue = value.slice(0, start - removable) + value.slice(end);
        onChange(nextValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = start - removable;
          textarea.selectionEnd = start - removable;
        });
        return;
      }

      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selectedBlock = value.slice(lineStart, end);
      const lines = selectedBlock.split("\n");
      let removedFromFirstLine = 0;
      const nextLines = lines.map((line, index) => {
        if (line.startsWith(indent)) {
          if (index === 0) {
            removedFromFirstLine = indent.length;
          }
          return line.slice(indent.length);
        }
        if (line.startsWith(" ")) {
          if (index === 0) {
            removedFromFirstLine = 1;
          }
          return line.slice(1);
        }
        return line;
      });
      const nextValue = value.slice(0, lineStart) + nextLines.join("\n") + value.slice(end);
      onChange(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = Math.max(lineStart, start - removedFromFirstLine);
        textarea.selectionEnd = end - (selectedBlock.length - nextLines.join("\n").length);
      });
      return;
    }

    if (start !== end) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const selectedBlock = value.slice(lineStart, end);
      const nextBlock = selectedBlock
        .split("\n")
        .map((line) => `${indent}${line}`)
        .join("\n");
      const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(end);
      onChange(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = start + indent.length;
        textarea.selectionEnd = end + indent.length * selectedBlock.split("\n").length;
      });
      return;
    }

    const nextValue = value.slice(0, start) + indent + value.slice(end);
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + indent.length;
      textarea.selectionEnd = start + indent.length;
    });
  }

  return (
    <div
      ref={containerRef}
      className="code-editor"
      style={
        {
          minHeight: `${minHeight}px`,
          "--code-editor-left-rail": `${leftRailWidth}px`,
          "--code-editor-right-rail": `${rightRailWidth}px`
        } as CSSProperties
      }
    >
      <div aria-hidden="true" className="code-editor-overlay" ref={overlayRef}>
        {leftRail ? <div className="code-editor-rail code-editor-rail-left">{leftRail}</div> : null}
        <CodeRenderer code={value || " "} language={language} showLineNumbers getLineClassName={getLineClassName} />
        {rightRail ? <div className="code-editor-rail code-editor-rail-right">{rightRail}</div> : null}
      </div>
      <textarea
        id={id}
        ref={textareaRef}
        className="code-editor-input"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
