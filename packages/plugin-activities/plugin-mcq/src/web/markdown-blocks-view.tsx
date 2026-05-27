"use client";

import katex from "katex";
import { Fragment } from "react";
import { CodeRenderer } from "@cognelo/activity-ui";
import { type InlineToken, type McqBlock, renderInlineMarkdown, renderInlineTokens } from "../mcq";

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
          return (
            <p key={index} style={compact ? { margin: 0 } : undefined}>
              {renderInlineTokens(renderInlineMarkdown(block.text), renderInlineToken)}
            </p>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index} style={{ margin: 0, paddingLeft: 22 }}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineTokens(renderInlineMarkdown(item), renderInlineToken)}</li>
              ))}
            </ListTag>
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

function renderInlineToken(token: InlineToken, index: number) {
  if (token.type === "text") {
    return <Fragment key={index}>{token.text}</Fragment>;
  }

  if (token.type === "code") {
    return (
      <code key={index} style={{ background: "rgba(13, 27, 71, 0.06)", borderRadius: 6, padding: "0.1rem 0.35rem" }}>
        {token.text}
      </code>
    );
  }

  if (token.type === "math") {
    return <MathView key={index} expression={token.expression} displayMode={false} />;
  }

  if (token.type === "strong") {
    return <strong key={index}>{renderInlineTokens(token.children, renderInlineToken)}</strong>;
  }

  return <em key={index}>{renderInlineTokens(token.children, renderInlineToken)}</em>;
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
