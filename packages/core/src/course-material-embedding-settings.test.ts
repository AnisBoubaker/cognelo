import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), read: vi.fn(), write: vi.fn(), audit: vi.fn(), provider: vi.fn(), connection: vi.fn(), list: vi.fn(), raw: vi.fn() }));
vi.mock("@cognelo/db", () => {
  const db = { courseMaterialEmbeddingSettings: { findUnique: mocks.read, upsert: mocks.write }, courseAuditEvent: { create: mocks.audit }, $queryRaw: mocks.raw };
  return { Prisma: {}, prisma: { ...db, $transaction: (callback: (tx: unknown) => unknown) => callback(db) } };
});
vi.mock("./authorization", () => ({ assertCanManageCourse: mocks.authorize }));
vi.mock("./material-embeddings", () => ({ createCourseEmbeddingProvider: mocks.provider }));
vi.mock("./ai-agents", () => ({ getAiAgentConnectionForUser: mocks.connection, listAiAgentConnections: mocks.list, snapshotAiModelSelection: (connection: { id: string; model: string }, selectedByUserId: string) => ({ connectionId: connection.id, model: connection.model, selectedByUserId, endpointKey: "endpoint-hash" }) }));
const { getCourseMaterialEmbeddingSettings, updateCourseMaterialEmbeddingSettings } = await import("./course-material-embedding-settings");
const { AppError } = await import("./errors");
const user = { id: "manager", email: "manager@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
beforeEach(() => { vi.resetAllMocks(); mocks.read.mockResolvedValue(null); mocks.connection.mockResolvedValue({ id: "connection", model: "vectors", apiKey: "private-token" }); mocks.provider.mockResolvedValue({ connectionId: "connection", model: "vectors" }); mocks.list.mockResolvedValue({ connections: [] }); });
describe("course-wide material embedding configuration", () => {
  it("validates the embedding purpose and stores only the core selection snapshot with an audit", async () => {
    await updateCourseMaterialEmbeddingSettings(user, "course", { selection: { connectionId: "connection", model: "vectors" } });
    expect(mocks.connection).toHaveBeenCalledWith(user, { connectionId: "connection", model: "vectors" }, "embedding");
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ where: { courseId: "course" }, create: expect.objectContaining({ selection: { connectionId: "connection", model: "vectors", selectedByUserId: "manager", endpointKey: "endpoint-hash" } }) }));
    expect(JSON.stringify(mocks.write.mock.calls)).not.toContain("private-token"); expect(mocks.audit).toHaveBeenCalled();
  });
  it("preserves the setting after an invalid or unauthorized model choice", async () => {
    mocks.connection.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(updateCourseMaterialEmbeddingSettings(user, "course", { selection: { connectionId: "foreign", model: "vectors" } })).rejects.toMatchObject({ status: 403 });
    expect(mocks.write).not.toHaveBeenCalled();
    mocks.authorize.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(getCourseMaterialEmbeddingSettings(user, "course")).rejects.toMatchObject({ status: 403 });
  });
  it("clears only this course's selection when returning to the inherited default", async () => {
    await updateCourseMaterialEmbeddingSettings(user, "course", { selection: null });
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ where: { courseId: "course" }, update: { selection: {}, updatedByUserId: "manager" } }));
    expect(mocks.connection).not.toHaveBeenCalled();
  });
});
