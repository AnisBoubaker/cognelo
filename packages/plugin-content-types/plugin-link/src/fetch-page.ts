import { lookup } from "node:dns/promises";
import { request as requestHttp, type IncomingHttpHeaders } from "node:http";
import { request as requestHttps } from "node:https";
import { isIP } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import ipaddr from "ipaddr.js";
import { Parser } from "htmlparser2";
import { linkUrlSchema } from "./shared";
import { extractTeachingPage, MAX_SLIDE_SOURCE_BYTES, MAX_SLIDE_TOTAL_BYTES, SlideContentError } from "./teaching-page";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 24_000;
const TIMEOUT_MS = 10_000;
type Address = { address: string; family: number };
type PageResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer };

export class LinkPageError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) { super(message); }
}

export function isPublicAddress(address: string) {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  if (parsed.range() !== "unicast") return false;
  return parsed.kind() !== "ipv6" || parsed.match(ipaddr.parse("2000::"), 3);
}

export async function fetchLinkPage(value: string, dependencies: {
  collectLinks?: boolean;
  allowedHostname?: string;
  signal?: AbortSignal;
  resolve?: (hostname: string) => Promise<Address[]>;
  request?: (url: URL, address: Address, signal: AbortSignal, maxBytes: number) => Promise<PageResponse>;
} = {}) {
  const initialUrl = new URL(linkUrlSchema.parse(value));
  if (dependencies.signal?.aborted) throw new LinkPageError("LINK_FETCH_TIMEOUT", "The page took too long to respond.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  dependencies.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new LinkPageError("LINK_FETCH_TIMEOUT", "The page took too long to respond.")), { once: true }));
  async function loadPage(initial: URL, maxBytes: number, allowedOrigin?: string) {
    let url = initial;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      if (allowedOrigin && url.origin !== allowedOrigin) {
        throw new LinkPageError("LINK_SLIDE_ORIGIN", "External slide Markdown must remain on the same origin.");
      }
      if (dependencies.allowedHostname && url.hostname !== dependencies.allowedHostname) {
        throw new LinkPageError("LINK_OUTSIDE_DOMAIN", "The linked page redirects outside the original domain.");
      }
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await Promise.race([(dependencies.resolve ?? ((host) => lookup(host, { all: true })))(hostname), aborted]);
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
        throw new LinkPageError("LINK_URL_NOT_PUBLIC", "Only publicly reachable web pages can be summarized.");
      }
      const address = addresses.find((candidate) => candidate.family === 4) ?? addresses[0];
      const response = await Promise.race([(dependencies.request ?? requestPinnedPage)(url, address, controller.signal, maxBytes), aborted]);
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
        if (redirects === 3) throw new LinkPageError("LINK_TOO_MANY_REDIRECTS", "The page redirects too many times.");
        url = new URL(linkUrlSchema.parse(new URL(response.headers.location, url).href));
        continue;
      }
      // A non-200 response must never reach extraction or the AI provider.
      if (response.status !== 200) throw new LinkPageError("LINK_HTTP_STATUS", `The URL returned HTTP ${response.status}; HTTP 200 is required.`, { status: response.status });
      const contentType = response.headers["content-type"] ?? "";
      if (!/^(text\/(html|plain|markdown|x-markdown)|application\/xhtml\+xml)(;|$)/i.test(contentType)) {
        throw new LinkPageError("LINK_UNSUPPORTED_CONTENT", "Only HTML, Markdown and plain-text web pages can be summarized.");
      }
      let body = response.body;
      if (body.length > maxBytes) throw new LinkPageError("LINK_PAGE_TOO_LARGE", "The page is too large to summarize.");
      const encoding = response.headers["content-encoding"];
      if (encoding === "gzip") body = gunzipSync(body, { maxOutputLength: maxBytes });
      else if (encoding === "br") body = brotliDecompressSync(body, { maxOutputLength: maxBytes });
      else if (encoding === "deflate") body = inflateSync(body, { maxOutputLength: maxBytes });
      else if (encoding && encoding !== "identity") throw new LinkPageError("LINK_UNSUPPORTED_CONTENT", "The page encoding is unsupported.");
      if (body.length > maxBytes) throw new LinkPageError("LINK_PAGE_TOO_LARGE", "The page is too large to summarize.");
      const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType)?.[1] ?? "utf-8";
      let decoded: string;
      try { decoded = new TextDecoder(charset).decode(body); } catch { decoded = body.toString("utf8"); }
      return { url, contentType, decoded, sizeBytes: body.length };
    }
    throw new LinkPageError("LINK_TOO_MANY_REDIRECTS", "The page redirects too many times.");
  }
  try {
    const page = await loadPage(initialUrl, MAX_BYTES);
    const plainText = /^text\/(plain|markdown|x-markdown)(;|$)/i.test(page.contentType);
    const extracted = plainText
      ? { text: page.decoded.trim().slice(0, MAX_TEXT_CHARACTERS), links: [], shortened: page.decoded.trim().length > MAX_TEXT_CHARACTERS }
      : extractPageContent(page.decoded, dependencies.collectLinks ? page.url.href : undefined);
    if (!plainText) {
      const slides = extractTeachingPage(page.decoded, page.url.href);
      if (slides.hasMarkdownSlides) {
        const parts = [slides.text];
        let bytes = 0;
        // These are the deck's own content files, independent of optional link crawling.
        for (const url of slides.markdownUrls) {
          const part = await loadPage(new URL(url), MAX_SLIDE_SOURCE_BYTES, page.url.origin);
          if (!/^text\/(plain|markdown|x-markdown)(;|$)/i.test(part.contentType)) {
            throw new LinkPageError("LINK_UNSUPPORTED_CONTENT", "A slide source must contain Markdown or plain text.");
          }
          bytes += part.sizeBytes;
          if (bytes > MAX_SLIDE_TOTAL_BYTES) throw new LinkPageError("LINK_SLIDE_LIMIT", "This slide deck exceeds its text extraction limit.");
          if (!part.decoded.trim()) throw new LinkPageError("LINK_NO_READABLE_TEXT", "A slide source does not contain readable text.");
          parts.push(part.decoded.trim());
        }
        // Reserve text for each source so late chapters survive the summary's cap.
        const perPart = Math.floor((MAX_TEXT_CHARACTERS - (parts.length - 1) * 2) / parts.length);
        extracted.text = parts.map(part => part.slice(0, perPart)).join("\n\n");
        extracted.shortened = parts.some(part => part.length > perPart);
      }
    }
    if (extracted.text.length < 32) throw new LinkPageError("LINK_NO_READABLE_TEXT", "The page does not contain enough readable text to summarize.");
    return { url: page.url.href, ...extracted };
  } catch (error) {
    if (error instanceof SlideContentError) throw new LinkPageError(`LINK_${error.code}`, error.message);
    if (error instanceof LinkPageError) throw error;
    if (controller.signal.aborted) throw new LinkPageError("LINK_FETCH_TIMEOUT", "The page took too long to respond.");
    throw new LinkPageError("LINK_FETCH_FAILED", "The URL could not be reached.");
  } finally { clearTimeout(timer); dependencies.signal?.removeEventListener("abort", abort); }
}

export function requestPinnedPage(url: URL, address: Address, signal: AbortSignal, maxBytes = MAX_BYTES): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? requestHttps : requestHttp)(url, {
      method: "GET", agent: false, signal, family: address.family,
      // Reuse the validated address; do not resolve the hostname a second time.
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      maxHeaderSize: 16 * 1024,
      headers: { Accept: "text/html, text/plain, text/markdown, application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "Cognelo-Link-Summary/0.1" }
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status !== 200) {
        resolve({ status, headers: response.headers, body: Buffer.alloc(0) });
        response.destroy();
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          const error = new LinkPageError("LINK_PAGE_TOO_LARGE", "The page is too large to summarize.");
          reject(error); response.destroy(); request.destroy();
        } else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
      response.on("aborted", () => reject(new LinkPageError("LINK_FETCH_FAILED", "The page response was interrupted.")));
    });
    request.on("error", reject);
    request.end();
  });
}

export function extractPageText(html: string) { return extractPageContent(html).text; }

/** Resolve relative links against the final page URL (and HTML base), then constrain to its hostname. */
export function sameDomainPageUrl(href: string, pageUrl: string, baseUrl = pageUrl) {
  if (!href.trim() || href.trim().startsWith("#")) return null;
  try {
    const page = new URL(pageUrl); page.hash = "";
    const url = new URL(linkUrlSchema.parse(new URL(href, baseUrl).href)); url.hash = "";
    return url.hostname === page.hostname && url.href !== page.href ? url.href : null;
  } catch { return null; }
}

export function extractPageContent(html: string, pageUrl?: string) {
  const ignoredTags = new Set(["script", "style", "noscript", "template", "svg", "canvas"]);
  let ignored = 0;
  let mainDepth = 0;
  let titleDepth = 0;
  let description = "";
  let baseHref: string | undefined;
  const hrefs: string[] = [];
  const title: string[] = [], all: string[] = [], main: string[] = [];
  const parser = new Parser({
    onopentag(name, attributes) {
      if (ignoredTags.has(name)) ignored += 1;
      if (!ignored && pageUrl) {
        if (name === "base" && baseHref === undefined && attributes.href) baseHref = attributes.href;
        if (name === "a" && attributes.href) hrefs.push(attributes.href);
      }
      if (name === "main" || name === "article") mainDepth += 1;
      if (name === "title") titleDepth += 1;
      if (name === "meta" && (attributes.name === "description" || attributes.property === "og:description")) description ||= attributes.content ?? "";
    },
    ontext(text) {
      if (ignored) return;
      all.push(text);
      if (mainDepth) main.push(text);
      if (titleDepth) title.push(text);
    },
    onclosetag(name) {
      if (ignoredTags.has(name)) ignored = Math.max(0, ignored - 1);
      if (name === "main" || name === "article") mainDepth = Math.max(0, mainDepth - 1);
      if (name === "title") titleDepth = Math.max(0, titleDepth - 1);
    }
  }, { decodeEntities: true });
  parser.end(html);
  const text = [title.join(" "), description, (main.length ? main : all).join(" ")].join("\n").replace(/\s+/g, " ").trim();
  let baseUrl = pageUrl;
  if (pageUrl && baseHref) { try { baseUrl = new URL(baseHref, pageUrl).href; } catch { /* Invalid bases fall back to the response URL. */ } }
  const links = pageUrl ? [...new Set(hrefs.flatMap((href) => { const url = sameDomainPageUrl(href, pageUrl, baseUrl); return url ? [url] : []; }))] : [];
  return { text: text.slice(0, MAX_TEXT_CHARACTERS), links, shortened: text.length > MAX_TEXT_CHARACTERS };
}
