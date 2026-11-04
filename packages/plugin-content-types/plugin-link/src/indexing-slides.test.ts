import { beforeEach, expect, it, vi } from "vitest";
import type { ServerContentResourceRecord } from "@cognelo/content-type-sdk/server";

const fetchMaterial = vi.hoisted(() => vi.fn());
vi.mock("@cognelo/core", () => ({
  fetchPublicMaterial: fetchMaterial, contentIndexRevision: vi.fn(), extractMaterialPdfText: vi.fn(),
  AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
}));
const { linkMaterialIndexing } = await import("./indexing");
const user = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
const resource: ServerContentResourceRecord = { id: "lecture", courseId: "course", title: "C slides", contentTypeKey: "link", pluginKey: "link-content", metadata: { url: "https://example.org/course/" } };

beforeEach(() => vi.resetAllMocks());

it("indexes complete external slide files in order without using the short summary limit", async () => {
  const body = "# First chapter\n" + "Typed variables and parameters. ".repeat(1200);
  fetchMaterial.mockImplementation(async (url: string) => ({ url,
    contentType: url.endsWith(".md") ? "text/markdown" : "text/html",
    bytes: Buffer.from(url.endsWith("first.md") ? body : url.endsWith("last.md") ? "# Last chapter\nprintf prints formatted values."
      : '<section data-markdown="first.md"></section><section data-markdown="last.md"></section><script>executeNothing()</script>')
  }));
  const store = vi.fn().mockResolvedValue({ id: "index" });
  await linkMaterialIndexing.prepare({ user, resource, store });
  const document = store.mock.calls[0]![0].documents[0];
  expect(document.text).toContain(body);
  expect(document.text).toContain("printf prints formatted values");
  expect(document.text).not.toContain("executeNothing");
  expect(fetchMaterial.mock.calls.map(([url]) => url)).toEqual(["https://example.org/course/", "https://example.org/course/first.md", "https://example.org/course/last.md"]);
  expect(fetchMaterial.mock.calls[1]![1]).toMatchObject({ allowedHostname: "example.org", maxBytes: 512 * 1024 });
});

it("never stores an incomplete slide index after a required source fails", async () => {
  fetchMaterial.mockResolvedValueOnce({ url: "https://example.org/course/", contentType: "text/html", bytes: Buffer.from('<title>C lecture</title><section data-markdown="missing.md"></section>') });
  fetchMaterial.mockRejectedValueOnce(new Error("HTTP 404"));
  const store = vi.fn();
  await expect(linkMaterialIndexing.prepare({ user, resource, store })).rejects.toThrow("HTTP 404");
  expect(store).not.toHaveBeenCalled();
});

it("never sends navigation/loading-only content to embedding storage", async () => {
  fetchMaterial.mockResolvedValue({ url: "https://example.org/course/", contentType: "text/html", bytes: Buffer.from('<title>Programming course</title><nav>Home Courses Login</nav><main>Loading…</main>') });
  const store = vi.fn();
  await expect(linkMaterialIndexing.prepare({ user, resource, store })).rejects.toMatchObject({ code: "MATERIAL_LINK_TEXT_INCOMPLETE" });
  expect(store).not.toHaveBeenCalled();
});

it.each(["", "<html><title>Redirected landing page</title></html>"])("rejects an empty or HTML slide response before storage", async value => {
  fetchMaterial.mockResolvedValueOnce({ url: "https://example.org/course/", contentType: "text/html", bytes: Buffer.from('<section data-markdown="chapter.md"></section>') });
  fetchMaterial.mockResolvedValueOnce({ url: "https://example.org/course/chapter.md", contentType: value ? "text/html" : "text/markdown", bytes: Buffer.from(value) });
  const store = vi.fn();
  await expect(linkMaterialIndexing.prepare({ user, resource, store })).rejects.toMatchObject({ code: "MATERIAL_SLIDE_UNREADABLE" });
  expect(store).not.toHaveBeenCalled();
});
