import { AppError, contentIndexRevision, extractMaterialPdfText, fetchPublicMaterial } from "@cognelo/core";
import type { ContentIndexingService } from "@cognelo/content-type-sdk/server";
import { readLinkMetadata } from "./shared";
import { extractTeachingPage, MAX_SLIDE_SOURCE_BYTES, MAX_SLIDE_TOTAL_BYTES, SlideContentError } from "./teaching-page";
import { assertReadableLinkMaterial, extractHtmlMaterialContent } from "./embedding-content";
export { extractTeachingPage } from "./teaching-page";

export const linkMaterialIndexing: ContentIndexingService = {
  policy: resource => ({ revision: contentIndexRevision({ url: readLinkMetadata(resource.metadata).url, title: resource.title, extractionVersion: "readable-content-v2" }) }),
  async prepare({ resource, signal, store }) {
    const page = await fetchPublicMaterial(readLinkMetadata(resource.metadata).url, { signal, maxBytes: 25 * 1024 * 1024 });
    let text: string;
    if (/application\/pdf/i.test(page.contentType) || page.bytes.subarray(0, 5).toString() === "%PDF-") text = await extractMaterialPdfText(page.bytes, signal);
    else if (/^text\/(plain|markdown|x-markdown)(;|$)/i.test(page.contentType)) text = page.bytes.toString("utf8");
    else if (/text\/html|application\/xhtml\+xml/i.test(page.contentType)) {
      let extracted: ReturnType<typeof extractTeachingPage>;
      try { extracted = extractTeachingPage(page.bytes.toString("utf8"), page.url); }
      catch (error) {
        if (error instanceof SlideContentError) throw new AppError(error.code === "SLIDE_LIMIT" ? 413 : 422, `MATERIAL_${error.code}`, error.message);
        throw error;
      }
      const content = extractHtmlMaterialContent(page.bytes.toString("utf8"));
      const parts = [content.text], evidence = [content.evidence]; let bytes = 0;
      for (const url of extracted.markdownUrls) {
        const part = await fetchPublicMaterial(url, { signal, allowedHostname: new URL(page.url).hostname, maxBytes: MAX_SLIDE_SOURCE_BYTES });
        if (new URL(part.url).origin !== new URL(page.url).origin || !/^text\/(plain|markdown|x-markdown)(;|$)/i.test(part.contentType) || !part.bytes.toString("utf8").trim()) {
          throw new AppError(422, "MATERIAL_SLIDE_UNREADABLE", "A required slide source did not return readable same-origin Markdown. Check the material or use a PDF/text version.");
        }
        bytes += part.bytes.length;
        if (bytes > MAX_SLIDE_TOTAL_BYTES) throw new AppError(413, "MATERIAL_SLIDE_LIMIT", "This slide deck exceeds its text extraction limit.");
        parts.push(part.bytes.toString("utf8"));
        evidence.push(part.bytes.toString("utf8"));
      }
      text = parts.join("\n\n");
      assertReadableLinkMaterial(evidence.join("\n\n"));
    } else throw new AppError(422, "MATERIAL_LINK_UNSUPPORTED", "Linked materials must contain HTML, plain text, Markdown or PDF.");
    assertReadableLinkMaterial(text);
    return store({ sourceId: resource.id, documents: [{ id: `${resource.id}:page`, sourceId: resource.id, title: resource.title, text, kind: "plain_text", metadata: { url: page.url } }], diagnostics: [] });
  }
};
