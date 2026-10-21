import { fetchLinkPage, sameDomainPageUrl } from "./fetch-page";
import { MAX_SUMMARY_LINKED_PAGES, type LinkSummarySources } from "./shared";

export const MAX_SUMMARY_SOURCE_CHARACTERS = 200_000;
export const SUMMARY_LINK_FETCH_BUDGET_MS = 30_000;
const CONCURRENCY = 3;
type Page = Awaited<ReturnType<typeof fetchLinkPage>>;

/** Only the root's links are fetched. Linked-page links are deliberately never traversed. */
export async function collectLinkSummaryPages(root: Page) {
  const links = [...new Set((root.links ?? []).flatMap((href) => {
    const url = sameDomainPageUrl(href, root.url);
    return url ? [url] : [];
  }))];
  const selected = links.slice(0, MAX_SUMMARY_LINKED_PAGES);
  const results: Array<Page | null> = Array(selected.length).fill(null);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUMMARY_LINK_FETCH_BUDGET_MS);
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, selected.length) }, async () => {
      while (!controller.signal.aborted) {
        const index = next++;
        if (index >= selected.length) return;
        try {
          results[index] = await fetchLinkPage(selected[index]!, { allowedHostname: new URL(root.url).hostname, signal: controller.signal });
        } catch { /* Failed pages are reported, and successful source pages are retained. */ }
      }
    }));
  } finally { clearTimeout(timer); }
  const pages = [root];
  const canonical = (url: string) => { const value = new URL(url); value.hash = ""; return value.href; };
  const seen = new Set([canonical(root.url)]);
  for (const page of results) {
    if (!page || seen.has(canonical(page.url))) continue;
    seen.add(canonical(page.url)); pages.push(page);
  }
  // Reserve an equal share for every successful page, so a long root cannot crowd out linked pages.
  const perPage = Math.floor(MAX_SUMMARY_SOURCE_CHARACTERS / pages.length);
  const sources: LinkSummarySources = {
    includedPages: pages.length,
    unavailablePages: results.filter((page) => !page).length,
    omittedPages: Math.max(0, links.length - selected.length),
    shortened: pages.some((page) => page.shortened || page.text.length > perPage)
  };
  return { pages: pages.map((page) => ({ ...page, text: page.text.slice(0, perPage) })), sources };
}
