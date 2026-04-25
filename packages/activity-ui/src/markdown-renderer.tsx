"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

type MarkdownRendererProps = {
  markdown: string;
  className?: string;
  compact?: boolean;
};

marked.setOptions({
  breaks: true,
  gfm: true
});

export function MarkdownRenderer({ markdown, className, compact = false }: MarkdownRendererProps) {
  const html = useMemo(() => {
    const rendered = marked.parser(marked.lexer(markdown ?? ""));
    return DOMPurify.sanitize(rendered, {
      USE_PROFILES: { html: true }
    });
  }, [markdown]);

  if (!markdown.trim()) {
    return null;
  }

  return (
    <div
      className={["markdown-renderer", compact ? "is-compact" : "", className ?? ""].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
