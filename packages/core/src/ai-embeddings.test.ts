import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), owner: vi.fn() }));
vi.mock("./ai-http", () => ({ fetchAiResponse: mocks.fetch }));
vi.mock("@cognelo/db", () => ({ prisma: { user: { findUnique: mocks.owner } }, Prisma: {} }));
import { requestAiEmbeddings } from "./ai-embeddings";
const connection = { ownerId: null, provider: "codex" as const, baseUrl: "https://provider.example/v1/", apiKey: "synthetic-key", model: "vectors-v2" };

describe("embedding provider adapters", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each(["openai", "codex"] as const)("uses the configured %s credential and model, and restores response ordering", async provider => {
    mocks.fetch.mockResolvedValue(Response.json({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }));
    expect(await requestAiEmbeddings({ ...connection, provider }, ["first", "second"], null)).toEqual([[1, 0], [0, 1]]);
    expect(mocks.fetch).toHaveBeenCalledWith("https://provider.example/v1/embeddings", expect.objectContaining({
      headers: { "Content-Type": "application/json", Authorization: "Bearer synthetic-key" },
      body: JSON.stringify({ model: "vectors-v2", input: ["first", "second"], encoding_format: "float" })
    }), true);
  });
  it("uses Ollama's embedding endpoint with native dimensions and no truncation", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ embeddings: [[0.2, 0.3, 0.4]] }));
    expect(await requestAiEmbeddings({ ...connection, provider: "ollama", baseUrl: null, apiKey: null }, ["reference"], null)).toEqual([[0.2, 0.3, 0.4]]);
    expect(mocks.fetch).toHaveBeenCalledWith("http://localhost:11434/api/embed", expect.objectContaining({ body: JSON.stringify({ model: "vectors-v2", input: ["reference"], truncate: false }) }), true);
  });
  it.each([
    null, { data: [null, null] },
    { data: [{ index: 0, embedding: [1] }] },
    { data: [{ index: 0, embedding: [1, 0] }, { index: 0, embedding: [1, 0] }] },
    { data: [{ index: 0, embedding: [1, 0] }, { index: 2, embedding: [1, 0] }] },
    { data: [{ index: 0, embedding: [1, 0] }, { index: 1, embedding: [1] }] },
    { data: [{ index: 0, embedding: [null, 0] }, { index: 1, embedding: [1, 0] }] },
    { data: [{ index: 0, embedding: [1e100, 0] }, { index: 1, embedding: [1, 0] }] }
  ])("rejects incomplete, mismatched, or unsafe vectors", async payload => {
    mocks.fetch.mockResolvedValue(Response.json(payload));
    await expect(requestAiEmbeddings(connection, ["first", "second"], 2)).rejects.toMatchObject({ code: "EMBEDDING_RESPONSE_INVALID" });
  });
  it("retains configured dimensions for legacy OpenAI indexes and never reflects provider error bodies", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ data: [{ index: 0, embedding: Array(1536).fill(0) }] }));
    await requestAiEmbeddings({ ...connection, model: "text-embedding-3-small" }, ["reference"], 1536);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toHaveProperty("dimensions", 1536);
    mocks.fetch.mockResolvedValue(Response.json({ error: "synthetic-secret" }, { status: 429 }));
    await expect(requestAiEmbeddings(connection, ["reference"], null)).rejects.toMatchObject({ status: 429, code: "EMBEDDING_REQUEST_FAILED" });
  });
  it("preserves private-address restrictions for personal non-admin connections", async () => {
    mocks.owner.mockResolvedValue({ isActive: true, roles: [{ role: { key: "teacher" } }] });
    mocks.fetch.mockResolvedValue(Response.json({ data: [{ index: 0, embedding: [1, 0] }] }));
    await requestAiEmbeddings({ ...connection, ownerId: "teacher" }, ["reference"], null);
    expect(mocks.fetch.mock.calls[0][2]).toBe(false);
    await expect(requestAiEmbeddings({ ...connection, provider: "claude" }, ["reference"], null)).rejects.toMatchObject({ code: "AI_EMBEDDING_PROVIDER_UNSUPPORTED" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
