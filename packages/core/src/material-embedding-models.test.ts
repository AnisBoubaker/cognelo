import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ indexes: vi.fn(), vectors: vi.fn(), saveVector: vi.fn(), embed: vi.fn(), selected: vi.fn(), teacher: vi.fn() }));
vi.mock("@cognelo/db", () => ({ Prisma: {}, prisma: { contentMaterialIndex: { findMany: mocks.indexes }, contentMaterialVector: { findMany: mocks.vectors, upsert: mocks.saveVector } } }));
vi.mock("./authorization", () => ({ assertCanViewCourse: vi.fn(), assertCanManageCourse: vi.fn() }));
vi.mock("./course-content", () => ({ getContentResourceForPluginRoute: vi.fn() }));
vi.mock("./ai-embeddings", () => ({ requestAiEmbeddings: mocks.embed }));
vi.mock("./ai-agents", async importOriginal => ({ ...await importOriginal<typeof import("./ai-agents")>(), getCourseAiAgentConnection: mocks.selected, getCourseTeacherQuestionAuthoringAiAgentConnection: mocks.teacher }));
import { contentIndexRevision, createCourseEmbeddingProvider, createPreparedMaterialSearch, encodeVector } from "./material-embeddings";
const user = { id: "admin", email: "admin@example.test", roles: ["admin" as const], name: null, firstName: null, lastName: null };
const connection = { id: "connection", ownerId: null, provider: "openai" as const, model: "changed-text-model", models: [], baseUrl: null, apiKey: "synthetic" };
describe("embedding compatibility and frozen search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.teacher.mockResolvedValue(connection);
    mocks.selected.mockImplementation(async (_user, _course, selected) => ({ ...connection, model: selected.model }));
    mocks.vectors.mockResolvedValue([]);
    mocks.saveVector.mockImplementation(async ({ create }) => create);
  });
  it("keeps the original key for legacy embeddings regardless of the text model or token", async () => {
    const original = contentIndexRevision({ provider: "openai", baseUrl: "https://api.openai.com/v1", model: "text-embedding-3-small", dimensions: 1536 });
    expect((await createCourseEmbeddingProvider(user, "course")).modelKey).toBe(original);
    mocks.selected.mockImplementation(async (_user, _course, selected) => ({ ...connection, provider: "codex", apiKey: "replacement", model: selected.model }));
    const compatible = await createCourseEmbeddingProvider(user, "course", { connectionId: "connection", model: "text-embedding-3-small" });
    expect(compatible.modelKey).toBe(original);
    expect(compatible.selection).not.toHaveProperty("apiKey");
    expect((await createCourseEmbeddingProvider(user, "course", { connectionId: "connection", model: "new-vector-model" })).modelKey).not.toBe(original);
  });
  it("queries an old index using its original embedding model after the default text model changes", async () => {
    const modelKey = contentIndexRevision({ provider: "openai", baseUrl: "https://api.openai.com/v1", model: "text-embedding-3-small", dimensions: 1536 });
    const values = [1, ...Array(1535).fill(0)];
    const vector = { id: "vector", modelKey, dimensions: 1536, values: encodeVector(values) };
    mocks.indexes.mockResolvedValue([{ id: "old-index", courseId: "course", resourceId: null, sourceId: "retained-material", connectionId: "connection", embeddingConfig: {}, modelKey, documents: [{ id: "chunk", sourceId: "retained-material", title: "C", text: "Function arguments", kind: "plain_text", vectorId: "vector" }] }]);
    mocks.vectors.mockResolvedValueOnce([vector]).mockResolvedValueOnce([]);
    mocks.embed.mockResolvedValue([values]);
    const search = await createPreparedMaterialSearch(user, "course", ["old-index"]);
    expect(mocks.selected).toHaveBeenCalledWith(user, "course", expect.objectContaining({ connectionId: "connection", model: "text-embedding-3-small" }), "embedding", true);
    expect(await search.search("parameters")).toMatchObject([{ title: "C", score: 1 }]);
    expect(mocks.embed).toHaveBeenCalledWith(expect.objectContaining({ model: "text-embedding-3-small" }), ["parameters"], 1536, undefined);
  });
  it("rejects a model's changed native dimensions when combining cached and new vectors", async () => {
    const provider = await createCourseEmbeddingProvider(user, "course", { connectionId: "connection", model: "native-vectors" });
    const id = contentIndexRevision({ modelKey: provider.modelKey, text: "cached" });
    mocks.vectors.mockResolvedValue([{ id, dimensions: 2, values: encodeVector([1, 0]) }]);
    mocks.embed.mockResolvedValue([[1, 0, 0]]);
    await expect(provider.embedTexts(["cached", "new"])).rejects.toMatchObject({ code: "EMBEDDING_INDEX_INCOMPATIBLE" });
    expect(mocks.saveVector).not.toHaveBeenCalled();
  });
});
