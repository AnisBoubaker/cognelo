import katex from "katex";
import { Marked, type Tokens } from "marked";

type MathToken = Tokens.Generic & {
  expression: string;
  displayMode: boolean;
};

const markdownParser = new Marked(
  {
    breaks: true,
    gfm: true
  },
  {
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
          return renderMathToken(token as MathToken);
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
          return renderMathToken(token as MathToken);
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
          return renderMathToken(token as MathToken);
        }
      }
    ]
  }
);

export function renderMarkdownToHtml(markdown: string) {
  return markdownParser.parser(markdownParser.lexer(markdown ?? ""));
}

function renderMathToken(token: MathToken) {
  const rendered = katex.renderToString(token.expression, {
    displayMode: token.displayMode,
    strict: "ignore",
    throwOnError: false
  });

  if (token.displayMode) {
    return `<div class="markdown-math-display">${rendered}</div>\n`;
  }
  return `<span class="markdown-math-inline">${rendered}</span>`;
}
