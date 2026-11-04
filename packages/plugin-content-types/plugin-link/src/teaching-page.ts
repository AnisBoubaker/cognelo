import { Parser } from "htmlparser2";

export const MAX_SLIDE_SOURCES = 30;
export const MAX_SLIDE_SOURCE_BYTES = 512 * 1024;
export const MAX_SLIDE_TOTAL_BYTES = 4 * 1024 * 1024;

export class SlideContentError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Shared by summaries and embeddings; inert Markdown is read, never executed. */
export function extractTeachingPage(html: string, pageUrl: string) {
  const text: string[] = [], markdownUrls: string[] = [], stack: boolean[] = [];
  let hasMarkdownSlides = false;
  const parser = new Parser({
    onopentag(name, attrs) {
      const hidden = Boolean(stack.at(-1)) || ["style", "noscript", "svg", "canvas"].includes(name)
        || (name === "script" && attrs.type !== "text/template" && attrs.type !== "text/markdown");
      stack.push(hidden);
      if (!hidden && Object.hasOwn(attrs, "data-markdown")) {
        hasMarkdownSlides = true;
        if (attrs["data-markdown"].trim()) {
          const target = new URL(attrs["data-markdown"], pageUrl);
          if (target.origin !== new URL(pageUrl).origin || target.username || target.password) {
            throw new SlideContentError("SLIDE_ORIGIN", "External slide Markdown must be hosted on the same origin without credentials.");
          }
          target.hash = "";
          markdownUrls.push(target.href);
        }
      }
      if (!hidden) text.push("\n");
    },
    ontext(value) { if (!stack.at(-1)) text.push(value); },
    onclosetag() { if (!stack.pop()) text.push("\n"); }
  }, { decodeEntities: true });
  parser.end(html);
  const urls = [...new Set(markdownUrls)];
  if (urls.length > MAX_SLIDE_SOURCES) throw new SlideContentError("SLIDE_LIMIT", "This slide deck has too many external Markdown sources.");
  return { text: text.join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), markdownUrls: urls, hasMarkdownSlides };
}
