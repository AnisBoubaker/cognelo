import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fetchPage = vi.hoisted(() => vi.fn());
vi.mock("./fetch-page", async (original) => ({ ...await original<typeof import("./fetch-page")>(), fetchLinkPage: fetchPage }));
import { collectLinkSummaryPages, MAX_SUMMARY_SOURCE_CHARACTERS, SUMMARY_LINK_FETCH_BUDGET_MS } from "./summary-sources";
import { MAX_SUMMARY_LINKED_PAGES } from "./shared";

const root = { url: "https://example.org/guide", text: "Main educational guide.", shortened: false, links: [] as string[] };
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe("one-level summary sources", () => {
  it("keeps root and successful children, skips failures, deduplicates redirected pages, and never follows grandchildren", async () => {
    fetchPage.mockImplementation(async (url: string) => {
      if (url.endsWith("/broken")) throw new Error("HTTP 404");
      return { ...root, url: "https://example.org/child", text: "Child guide about loops.", links: ["https://example.org/grandchild"] };
    });
    const result = await collectLinkSummaryPages({ ...root, links: ["https://example.org/child#one", "https://example.org/child#two", "https://evil.test/outside", "https://example.org/broken", "https://example.org/alias"] });
    expect(fetchPage.mock.calls.map(([url]) => url)).toEqual(["https://example.org/child", "https://example.org/broken", "https://example.org/alias"]);
    expect(fetchPage.mock.calls.every(([, options]) => options.allowedHostname === "example.org")).toBe(true);
    expect(result.pages.map(({ text }) => text)).toEqual([root.text, "Child guide about loops."]);
    expect(result.sources).toEqual({ includedPages: 2, unavailablePages: 1, omittedPages: 0, shortened: false });
  });

  it("bounds requests and concurrency, gives every successful page space, and reports truncation", async () => {
    let active = 0, peak = 0;
    fetchPage.mockImplementation(async (url: string) => {
      active++; peak = Math.max(peak, active);
      await Promise.resolve(); active--;
      return { ...root, url, text: `Child ${url}\n${"x".repeat(24_000)}` };
    });
    const result = await collectLinkSummaryPages({ ...root, text: "root".repeat(6000), links: Array.from({ length: 25 }, (_, index) => `https://example.org/page-${index}`) });
    expect(fetchPage).toHaveBeenCalledTimes(MAX_SUMMARY_LINKED_PAGES);
    expect(peak).toBe(3);
    expect(result.pages).toHaveLength(21);
    expect(result.pages.reduce((sum, page) => sum + page.text.length, 0)).toBeLessThanOrEqual(MAX_SUMMARY_SOURCE_CHARACTERS);
    expect(result.pages.every(({ text }) => text.length > 9000)).toBe(true);
    expect(result.sources).toEqual({ includedPages: 21, unavailablePages: 0, omittedPages: 5, shortened: true });
  });

  it("cancels slow children at the crawl deadline and reports unstarted pages without losing the root", async () => {
    vi.useFakeTimers();
    fetchPage.mockImplementation((_url, { signal }: { signal: AbortSignal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Timeout")), { once: true })));
    const pending = collectLinkSummaryPages({ ...root, links: Array.from({ length: 5 }, (_, index) => `https://example.org/${index}`) });
    await vi.advanceTimersByTimeAsync(SUMMARY_LINK_FETCH_BUDGET_MS + 1);
    const result = await pending;
    expect(result.pages).toMatchObject([{ url: root.url, text: root.text }]);
    expect(result.sources.unavailablePages).toBe(5);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
