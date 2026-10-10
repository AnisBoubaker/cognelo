"use client";

import katex from "katex";
import { CodeRenderer, MarkdownRenderer } from "@cognelo/activity-ui";
import { type McqBlock } from "../mcq";

export function MarkdownBlocksView({ blocks, compact = false }: { blocks: McqBlock[]; compact?: boolean }) {
  return (
    <div className="stack" style={{ gap: compact ? 8 : 12 }}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level <= 2) {
            return (
              <h3 key={index} style={compact ? { margin: 0 } : undefined}>
                {block.text}
              </h3>
            );
          }
          if (block.level === 3) {
            return (
              <h4 key={index} style={compact ? { margin: 0 } : undefined}>
                {block.text}
              </h4>
            );
          }
          return (
            <h5 key={index} style={compact ? { margin: 0 } : undefined}>
              {block.text}
            </h5>
          );
        }

        if (block.type === "paragraph") {
          return <MarkdownRenderer key={index} markdown={block.text} compact={compact} />;
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index} style={{ margin: 0, paddingLeft: 22 }}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}><MarkdownRenderer markdown={item} compact /></li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "table") {
          return (
            <div key={index} style={{ maxWidth: "100%", overflowX: "auto" }}>
              <MarkdownRenderer markdown={block.markdown} compact={compact} />
            </div>
          );
        }

        if (block.type === "math") {
          return <MathView key={index} expression={block.expression} displayMode={block.display} compact={compact} />;
        }

        return <CodeRenderer key={index} code={block.code} language={block.language} showLineNumbers />;
      })}
    </div>
  );
}

function MathView({ expression, displayMode, compact = false }: { expression: string; displayMode: boolean; compact?: boolean }) {
  const html = katex.renderToString(expression, {
    displayMode,
    strict: "ignore",
    throwOnError: false
  });

  if (displayMode) {
    return <div dangerouslySetInnerHTML={{ __html: html }} style={compact ? { margin: 0 } : undefined} />;
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
