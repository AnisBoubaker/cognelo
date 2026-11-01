import { AppError, contentIndexRevision, extractMaterialPdfText, fetchPublicMaterial } from "@cognelo/core";
import type { ContentIndexingService } from "@cognelo/content-type-sdk/server";
import { Parser } from "htmlparser2";
import { readLinkMetadata } from "./shared";

/** Includes Reveal.js inline/external Markdown without executing page scripts. */
export function extractTeachingPage(html: string, pageUrl: string) {
  const text: string[] = [], markdownUrls: string[] = []; const stack: boolean[] = [];
  const parser = new Parser({
    onopentag(name, attrs) {
      const hidden = Boolean(stack.at(-1)) || ["style", "noscript", "svg", "canvas"].includes(name) || (name === "script" && attrs.type !== "text/template" && attrs.type !== "text/markdown");
      stack.push(hidden);
      if (!hidden && attrs["data-markdown"]) {
        const target = new URL(attrs["data-markdown"], pageUrl);
        if (target.origin !== new URL(pageUrl).origin) throw new AppError(422, "MATERIAL_SLIDE_ORIGIN", "External slide Markdown must be hosted on the same origin.");
        markdownUrls.push(target.href);
      }
      if (!hidden) text.push("\n");
    },
    ontext(value) { if (!stack.at(-1)) text.push(value); },
    onclosetag() { if (!stack.pop()) text.push("\n"); }
  }, { decodeEntities: true });
  parser.end(html);
  return { text: text.join("").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), markdownUrls: [...new Set(markdownUrls)] };
}
export const linkMaterialIndexing: ContentIndexingService = {
  policy: resource => ({ revision: contentIndexRevision({ url: readLinkMetadata(resource.metadata).url, title: resource.title }) }),
  async prepare({ resource, signal, store }) {
    const page = await fetchPublicMaterial(readLinkMetadata(resource.metadata).url, { signal, maxBytes: 25 * 1024 * 1024 });
    let text: string;
    if (/application\/pdf/i.test(page.contentType) || page.bytes.subarray(0, 5).toString() === "%PDF-") text = await extractMaterialPdfText(page.bytes, signal);
    else if (/text\/(plain|markdown)/i.test(page.contentType)) text = page.bytes.toString("utf8");
    else if (/text\/html|application\/xhtml\+xml/i.test(page.contentType)) {
      const extracted = extractTeachingPage(page.bytes.toString("utf8"), page.url);
      if (extracted.markdownUrls.length > 30) throw new AppError(413, "MATERIAL_SLIDE_LIMIT", "This slide deck has too many external Markdown sources.");
      const parts = [extracted.text]; let bytes = 0;
      for (const url of extracted.markdownUrls) {
        const part = await fetchPublicMaterial(url, { signal, allowedHostname: new URL(page.url).hostname, maxBytes: 512 * 1024 });
        bytes += part.bytes.length;
        if (bytes > 4 * 1024 * 1024) throw new AppError(413, "MATERIAL_SLIDE_LIMIT", "This slide deck exceeds its text extraction limit.");
        parts.push(part.bytes.toString("utf8"));
      }
      text = parts.join("\n\n");
    } else throw new AppError(422, "MATERIAL_LINK_UNSUPPORTED", "Linked materials must contain HTML, plain text, Markdown or PDF.");
    return store({ sourceId: resource.id, documents: text.trim() ? [{ id: `${resource.id}:page`, sourceId: resource.id, title: resource.title, text, kind: "plain_text", metadata: { url: page.url } }] : [], diagnostics: [] });
  }
};
