import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPageText, fetchLinkPage, isPublicAddress, requestPinnedPage } from "./fetch-page";

const pageText = "This educational page explains programming variables, loops, and functions with examples.";
const publicAddress = { address: "93.184.215.14", family: 4 };
const resolve = vi.fn(async () => [publicAddress]);

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("public link page fetching", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.1.1", "192.168.1.2", "169.254.169.254", "100.64.0.1", "0.0.0.0", "192.0.2.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::1", "64:ff9b::7f00:1"])("blocks non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["93.184.215.14", "8.8.8.8", "2606:4700:4700::1111"])("permits public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([201, 204, 304, 401, 403, 404, 500])("rejects HTTP %i before parsing the body", async (status) => {
    const request = vi.fn(async () => ({ status, headers: { "content-type": "text/html" }, body: Buffer.from(pageText) }));
    await expect(fetchLinkPage("https://example.org", { resolve, request })).rejects.toMatchObject({ code: "LINK_HTTP_STATUS", details: { status } });
  });

  it("rejects a DNS response containing any private address without connecting", async () => {
    const request = vi.fn();
    await expect(fetchLinkPage("https://example.org", { resolve: async () => [publicAddress, { address: "127.0.0.1", family: 4 }], request })).rejects.toMatchObject({ code: "LINK_URL_NOT_PUBLIC" });
    expect(request).not.toHaveBeenCalled();
  });

  it("validates redirected targets and rejects numeric loopback aliases", async () => {
    const request = vi.fn(async () => ({ status: 302, headers: { location: "http://2130706433/private" }, body: Buffer.alloc(0) }));
    await expect(fetchLinkPage("https://example.org", { resolve, request })).rejects.toMatchObject({ code: "LINK_URL_NOT_PUBLIC" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("bounds redirects and checks the final HTTP status", async () => {
    const request = vi.fn(async () => ({ status: 302, headers: { location: "/again" }, body: Buffer.alloc(0) }));
    await expect(fetchLinkPage("https://example.org", { resolve, request })).rejects.toMatchObject({ code: "LINK_TOO_MANY_REDIRECTS" });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("extracts readable HTML and handles compressed successful responses", async () => {
    const html = `<html><head><title>Programming guide</title></head><body>Menu <main>${pageText}<script>secret commands</script><style>hidden style</style></main></body></html>`;
    const request = vi.fn(async (_url: URL, _address: { address: string; family: number }, _signal: AbortSignal) => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" }, body: gzipSync(html) }));
    const page = await fetchLinkPage("https://example.org/guide", { resolve, request });
    expect(page.text).toContain(pageText);
    expect(page.text).toContain("Programming guide");
    expect(page.text).not.toMatch(/secret commands|hidden style|Menu/);
    expect(request.mock.calls[0]?.[1]).toEqual(publicAddress);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported, empty, and oversized pages", async () => {
    await expect(fetchLinkPage("https://example.org", { resolve, request: async () => ({ status: 200, headers: { "content-type": "application/pdf" }, body: Buffer.from(pageText) }) })).rejects.toMatchObject({ code: "LINK_UNSUPPORTED_CONTENT" });
    await expect(fetchLinkPage("https://example.org", { resolve, request: async () => ({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from("<script>Run JavaScript</script>") }) })).rejects.toMatchObject({ code: "LINK_NO_READABLE_TEXT" });
    await expect(fetchLinkPage("https://example.org", { resolve, request: async () => ({ status: 200, headers: { "content-type": "text/plain" }, body: Buffer.alloc(2 * 1024 * 1024 + 1) }) })).rejects.toMatchObject({ code: "LINK_PAGE_TOO_LARGE" });
    expect(extractPageText(`<main>${"Readable content. ".repeat(3000)}</main>`).length).toBeLessThanOrEqual(24_000);
  });

  it("times out stalled DNS resolution", async () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const pending = expect(fetchLinkPage("https://example.org", { resolve: () => new Promise(() => {}), request })).rejects.toMatchObject({ code: "LINK_FETCH_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_001);
    await pending;
    expect(request).not.toHaveBeenCalled();
  });

  it("connects to the validated address while retaining the original host", async () => {
    let host: string | undefined;
    const server = createServer((request, response) => {
      host = request.headers.host;
      expect(request.headers.cookie).toBeUndefined();
      expect(request.headers.authorization).toBeUndefined();
      response.writeHead(200, { "content-type": "text/plain" }); response.end(pageText);
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test server address.");
      const url = new URL(`http://page.example.test:${address.port}/guide`);
      const result = await requestPinnedPage(url, { address: "127.0.0.1", family: 4 }, AbortSignal.timeout(1000));
      expect(result.status).toBe(200);
      expect(result.body.toString()).toBe(pageText);
      expect(host).toBe(url.host);
    } finally { await new Promise<void>((done) => server.close(() => done())); }
  });
});

describe("one-level link extraction", () => {
  it("resolves relative/base URLs, deduplicates fragments, and excludes unrelated or unsafe links", async () => {
    const html = `<base href="/lessons/"><main>${pageText}
      <a href="intro#one">Intro</a><a href="intro#two">Repeated</a>
      <a href="../example?x=1&amp;y=2">Example</a><a href="//EXAMPLE.org/next">Next</a>
      <a href="#local">Local</a><a href="/guide#local">Self</a>
      <a href="https://sub.example.org/sub">Subdomain</a><a href="https://example.org.evil.test/">Other</a>
      <a href="javascript:alert(1)">Script</a><a href="mailto:teacher@example.org">Mail</a>
      <a href="https://user:pass@example.org/private">Credentials</a>
      <template><a href="/inert">Ignored template</a></template></main>`;
    const dependencies = { resolve, request: async () => ({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(html) }) };
    const page = await fetchLinkPage("https://example.org/guide", { ...dependencies, collectLinks: true });
    expect(page.links).toEqual(["https://example.org/lessons/intro", "https://example.org/example?x=1&y=2", "https://example.org/next"]);
    expect((await fetchLinkPage("https://example.org/guide", dependencies)).links).toEqual([]);
  });

  it("uses the final root hostname and never connects to an off-domain child redirect", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ status: 302, headers: { location: "https://www.example.org/guide" }, body: Buffer.alloc(0) })
      .mockResolvedValueOnce({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(`<main>${pageText}<a href="/next">Next</a></main>`) });
    expect((await fetchLinkPage("https://example.org/guide", { resolve, request, collectLinks: true })).links).toEqual(["https://www.example.org/next"]);
    request.mockReset().mockResolvedValue({ status: 302, headers: { location: "https://other.example.test/page" }, body: Buffer.alloc(0) });
    await expect(fetchLinkPage("https://www.example.org/next", { resolve, request, allowedHostname: "www.example.org" })).rejects.toMatchObject({ code: "LINK_OUTSIDE_DOMAIN" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("honors the total crawl cancellation while DNS is pending", async () => {
    const controller = new AbortController();
    const request = vi.fn();
    const pending = expect(fetchLinkPage("https://example.org", { signal: controller.signal, request, resolve: () => new Promise(() => {}) })).rejects.toMatchObject({ code: "LINK_FETCH_TIMEOUT" });
    controller.abort();
    await pending;
    expect(request).not.toHaveBeenCalled();
  });
});

describe("Reveal.js summary content", () => {
  const deck = '<title>C lecture</title><section data-markdown="slides/intro.md"></section><section data-markdown="slides/last.md#one"></section><section data-markdown="slides/last.md#two"></section><script>executeNothing()</script>';
  const html = (value: string) => ({ status: 200, headers: { "content-type": "text/html" }, body: Buffer.from(value) });
  const markdown = (value: string) => ({ status: 200, headers: { "content-type": "text/markdown; charset=utf-8" }, body: Buffer.from(value) });

  it("reads every declared slide file without enabling link crawling or fetching scripts", async () => {
    const request = vi.fn(async (url: URL) => url.pathname.endsWith(".md")
      ? markdown(url.pathname.endsWith("intro.md") ? "# Variables\nA variable stores a typed value. [Not a slide source](deeper.md)" : "# Input and output\nprintf displays formatted values.") : html(deck));
    const page = await fetchLinkPage("https://example.org/course/", { resolve, request });
    expect(page.text).toContain("A variable stores a typed value");
    expect(page.text).toContain("printf displays formatted values");
    expect(page.text).not.toContain("executeNothing");
    expect(page.links).toEqual([]);
    expect(request.mock.calls.map(([url]) => url.href)).toEqual(["https://example.org/course/", "https://example.org/course/slides/intro.md", "https://example.org/course/slides/last.md"]);
  });

  it("reads inert inline Markdown and directly linked Markdown pages", async () => {
    const page = await fetchLinkPage("https://example.org", { resolve, request: async () => html(`<section data-markdown><script type="text/template"># Pointers\n${pageText}\nint *p;</script></section><script>executeNothing()</script>`) });
    expect(page.text).toContain("int *p;"); expect(page.text).not.toContain("executeNothing");
    expect((await fetchLinkPage("https://example.org/lesson.md", { resolve, request: async () => markdown(pageText) })).text).toBe(pageText);
  });

  it("reserves bounded text for the final chapter instead of filling the summary with early slides", async () => {
    const page = await fetchLinkPage("https://example.org/", { resolve, request: async url => url.pathname.endsWith(".md")
      ? markdown(url.pathname.endsWith("intro.md") ? "Early chapter. ".repeat(4000) : "FINAL_CHAPTER: formatted input and output.") : html(deck) });
    expect(page.shortened).toBe(true);
    expect(page.text.length).toBeLessThanOrEqual(24_000);
    expect(page.text).toContain("FINAL_CHAPTER");
  });

  it("fails when a required slide is unreadable rather than summarizing the page shell", async () => {
    const request = vi.fn(async (url: URL) => url.pathname.endsWith(".md") ? { status: 404, headers: {}, body: Buffer.alloc(0) } : html(deck));
    await expect(fetchLinkPage("https://example.org/", { resolve, request })).rejects.toMatchObject({ code: "LINK_HTTP_STATUS", details: { status: 404 } });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(["https://elsewhere.example/lesson.md", "https://user:pass@example.org/lesson.md"])("rejects an unrelated or credential-bearing slide source %s", async url => {
    const request = vi.fn(async () => html(`<section data-markdown="${url}"></section>`));
    await expect(fetchLinkPage("https://example.org/", { resolve, request })).rejects.toMatchObject({ code: "LINK_SLIDE_ORIGIN" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("checks slide DNS and rejects cross-origin redirects before connecting", async () => {
    const request = vi.fn(async (url: URL) => url.pathname.endsWith(".md")
      ? { status: 302, headers: { location: "https://example.org:8443/other.md" }, body: Buffer.alloc(0) } : html(deck));
    await expect(fetchLinkPage("https://example.org/", { resolve, request })).rejects.toMatchObject({ code: "LINK_SLIDE_ORIGIN" });
    expect(request).toHaveBeenCalledTimes(2);
    request.mockClear();
    const dns = vi.fn().mockResolvedValueOnce([publicAddress]).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(fetchLinkPage("https://example.org/", { resolve: dns, request })).rejects.toMatchObject({ code: "LINK_URL_NOT_PUBLIC" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("bounds source count, individual bytes and aggregate slide text", async () => {
    const many = Array.from({ length: 31 }, (_, i) => `<section data-markdown="${i}.md"></section>`).join("");
    const request = vi.fn(async () => html(many));
    await expect(fetchLinkPage("https://example.org/", { resolve, request })).rejects.toMatchObject({ code: "LINK_SLIDE_LIMIT" });
    expect(request).toHaveBeenCalledTimes(1);
    await expect(fetchLinkPage("https://example.org/", { resolve, request: async url => url.pathname.endsWith(".md")
      ? markdown("x".repeat(512 * 1024 + 1)) : html(deck) })).rejects.toMatchObject({ code: "LINK_PAGE_TOO_LARGE" });
    await expect(fetchLinkPage("https://example.org/", { resolve, request: async url => url.pathname.endsWith(".md")
      ? markdown("x".repeat(512 * 1024)) : html(many.replace(/<section data-markdown="(?:9|[12]\d|30)\.md"><\/section>/g, "")) })).rejects.toMatchObject({ code: "LINK_SLIDE_LIMIT" });
  });

  it("shares the existing total deadline with slide requests", async () => {
    vi.useFakeTimers();
    const dns = vi.fn().mockResolvedValueOnce([publicAddress]).mockImplementation(() => new Promise(() => {}));
    const request = vi.fn(async () => html(deck));
    const pending = expect(fetchLinkPage("https://example.org/", { resolve: dns, request })).rejects.toMatchObject({ code: "LINK_FETCH_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(10_001);
    await pending; expect(request).toHaveBeenCalledTimes(1);
  });
});
