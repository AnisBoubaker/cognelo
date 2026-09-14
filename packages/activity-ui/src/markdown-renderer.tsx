"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { renderMarkdownToHtml } from "./markdown";

type MarkdownRendererProps = {
  markdown: string;
  className?: string;
  compact?: boolean;
};

export function MarkdownRenderer({ markdown, className, compact = false }: MarkdownRendererProps) {
  const html = useMemo(() => {
    const rendered = renderMarkdownToHtml(markdown);
    return DOMPurify.sanitize(rendered, {
      USE_PROFILES: { html: true, mathMl: true, svg: true }
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
