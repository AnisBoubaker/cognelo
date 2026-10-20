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
