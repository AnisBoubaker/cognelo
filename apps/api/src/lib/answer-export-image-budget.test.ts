import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), asset: vi.fn(), read: vi.fn() }));
vi.mock("./answer-export-images", async (original) => ({ ...await original<typeof import("./answer-export-images")>(), fetchPublicExportImage: mocks.fetch }));
vi.mock("@cognelo/core", async (original) => ({ ...await original<typeof import("@cognelo/core")>(), getMediaAssetForDelivery: mocks.asset }));
vi.mock("node:fs/promises", async (original) => ({ ...await original<typeof import("node:fs/promises")>(), readFile: mocks.read }));
import { embedImages } from "./answer-export-pdf";
import { consumeAnswerExportImageBytes, createAnswerExportImageBudget } from "./answer-export-images";
const user = { id: "teacher", email: "teacher@example.test", roles: ["teacher" as const], name: null, firstName: null, lastName: null };
beforeEach(() => vi.clearAllMocks());

it("shares the byte budget and cache across separate documents in an export", async () => {
  const cache = new Map<string, string | null>();
  const budget = { remainingBytes: 6, deadline: Date.now() + 30_000 };
  mocks.fetch.mockImplementation(async (_url, shared) => {
    consumeAnswerExportImageBytes(shared, 4);
    return { bytes: Buffer.from("test"), mime: "image/png" };
  });
  const first = '<img src="https://example.test/a.png" alt="first">';
  expect(await embedImages(first, user, "en", cache, budget)).toContain("data:image/png;base64,");
  expect(await embedImages(first, user, "en", cache, budget)).toContain("data:image/png;base64,");
  const second = await embedImages('<img src="https://example.test/b.png" alt="second">', user, "en", cache, budget);
  expect(second).not.toContain("<img");
  await embedImages('<img src="https://example.test/c.png" alt="third">', user, "en", cache, budget);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(budget.remainingBytes).toBe(0);
});

it("bounds inline image data and stops new work after the shared deadline", async () => {
  const inline = '<img src="data:image/png;base64,dGVzdA==" alt="inline">';
  expect(await embedImages(inline, user, "en", new Map(), { remainingBytes: 2, deadline: Date.now() + 5000 })).not.toContain("<img");
  expect(await embedImages('<img src="https://example.test/a.png">', user, "en", new Map(), { remainingBytes: 10, deadline: 0 })).not.toContain("<img");
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("authorizes uploaded media and charges its bytes before reading the file", async () => {
  mocks.asset.mockResolvedValue({ filePath: "/private/synthetic.png", byteSize: 4, mimeType: "image/png" });
  mocks.read.mockResolvedValue(Buffer.from("test"));
  const source = '<img src="/api/media-assets/synthetic/content" alt="uploaded">';
  expect(await embedImages(source, user, "en", new Map(), createAnswerExportImageBudget())).toContain("data:image/png;base64,");
  expect(mocks.asset).toHaveBeenCalledWith(user, "synthetic");
  mocks.read.mockClear();
  expect(await embedImages(source, user, "en", new Map(), { remainingBytes: 2, deadline: Date.now() + 5000 })).not.toContain("<img");
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("caps HTML expansion even when a single cached image is repeated", async () => {
  mocks.fetch.mockResolvedValue({ bytes: Buffer.alloc(8_000_000), mime: "image/png" });
  const source = '<img src="https://example.test/repeated.png" alt="image">'.repeat(7);
  await expect(embedImages(source, user, "en", new Map(), createAnswerExportImageBudget())).rejects.toMatchObject({ status: 413, code: "ANSWER_EXPORT_TOO_LARGE" });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("preserves text and alt labels when embedding repeated images", async () => {
  mocks.fetch.mockResolvedValue({ bytes: Buffer.from("test"), mime: "image/png" });
  const src = "https://example.test/repeated.png";
  const source = `before<img alt="${src}" src="${src}">between<img src="${src}">after`;
  expect(await embedImages(source, user, "en", new Map(), createAnswerExportImageBudget())).toBe(
    `before<img alt="${src}" src="data:image/png;base64,dGVzdA==">between<img src="data:image/png;base64,dGVzdA==">after`
  );
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
