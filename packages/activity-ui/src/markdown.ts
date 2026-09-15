import katex from "katex";
import { Marked, type Tokens } from "marked";
import { markdownImageWidth, readMarkdownImageSize } from "./image-sizing";

type MathToken = Tokens.Generic & {
  expression: string;
  displayMode: boolean;
};

export type MarkdownRenderOptions = {
  protectMath?: boolean;
};

const markdownParser = createMarkdownParser(false);
const protectedMathMarkdownParser = createMarkdownParser(true);

export function renderMarkdownToHtml(markdown: string, options: MarkdownRenderOptions = {}) {
  const parser = options.protectMath ? protectedMathMarkdownParser : markdownParser;
  return parser.parser(parser.lexer(markdown ?? ""));
}

function createMarkdownParser(protectMath: boolean) {
  return new Marked(
    {
      breaks: true,
      gfm: true
    },
    {
      renderer: {
        image({ href, text, title }: Tokens.Image) {
          const width = markdownImageWidth(readMarkdownImageSize(href));
          return `<img src="${escapeHtmlAttribute(href)}" alt="${escapeHtmlAttribute(text)}"${title ? ` title="${escapeHtmlAttribute(title)}"` : ""}${width ? ` style="width: ${width}; height: auto"` : ""}>`;
        }
      },
      extensions: [
        {
          name: "displayMath",
          level: "block",
          start(source) {
            return source.search(/^ {0,3}\$\$/m);
          },
          tokenizer(source) {
            const match = /^ {0,3}\$\$[ \t]*\n?([\s\S]*?)\n? {0,3}\$\$[ \t]*(?:\n|$)/.exec(source);
            const expression = match?.[1]?.trim();
            if (!match || !expression) {
              return undefined;
            }
            return {
              type: "displayMath",
              raw: match[0],
              expression,
              displayMode: true
            } satisfies MathToken;
          },
          renderer(token) {
            return renderMathToken(token as MathToken, protectMath);
          }
        },
        {
          name: "inlineParenthesizedMath",
          level: "inline",
          start(source) {
            return source.indexOf("\\(");
          },
          tokenizer(source) {
            const match = /^\\\(((?:\\.|[^\\\n])*?)\\\)/.exec(source);
            const expression = match?.[1]?.trim();
            if (!match || !expression) {
              return undefined;
            }
            return {
              type: "inlineParenthesizedMath",
              raw: match[0],
              expression,
              displayMode: false
            } satisfies MathToken;
          },
          renderer(token) {
            return renderMathToken(token as MathToken, protectMath);
          }
        },
        {
          name: "inlineDollarMath",
          level: "inline",
          start(source) {
            return source.indexOf("$");
          },
          tokenizer(source) {
            const match = /^\$(?!\$)(?!\s)((?:\\.|[^\\$\n])*?[^\\$\s])\$(?!\$)/.exec(source);
            const expression = match?.[1]?.trim();
            if (!match || !expression) {
              return undefined;
            }
            return {
              type: "inlineDollarMath",
              raw: match[0],
              expression,
              displayMode: false
            } satisfies MathToken;
          },
          renderer(token) {
            return renderMathToken(token as MathToken, protectMath);
          }
        }
      ]
    }
  );
}

function renderMathToken(token: MathToken, protectMath: boolean) {
  const rendered = katex.renderToString(token.expression, {
    displayMode: token.displayMode,
    strict: "ignore",
    throwOnError: false
  });
  const protectedAttributes = protectMath
    ? ` contenteditable="false" data-markdown-math-source="${escapeHtmlAttribute(encodeURIComponent(token.raw.trimEnd()))}" data-markdown-math-display="${String(token.displayMode)}"`
    : "";

  if (token.displayMode) {
    return `<div class="markdown-math-display"${protectedAttributes}>${rendered}</div>\n`;
  }
  return `<span class="markdown-math-inline"${protectedAttributes}>${rendered}</span>`;
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
