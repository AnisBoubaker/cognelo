import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), available: vi.fn(), activity: vi.fn(), items: vi.fn(), resources: vi.fn(), provider: vi.fn(), status: vi.fn(), prepare: vi.fn(),
  read: vi.fn(), write: vi.fn(), tx: { $queryRaw: vi.fn(), $executeRaw: vi.fn() }
}));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: () => ({ usesMaterialEmbeddings: true }) }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivityMaterialReferencesHandler: () => ({ read: mocks.read, write: mocks.write }) }));
vi.mock("@cognelo/db", () => ({ prisma: { activity: { findFirst: mocks.activity }, $transaction: (callback: (tx: unknown) => unknown) => callback(mocks.tx) } }));
vi.mock("./authorization", () => ({ assertCanManageCourse: mocks.authorize }));
vi.mock("./plugins", () => ({ assertActivityTypeAvailable: mocks.available }));
vi.mock("./course-content", () => ({ listContentItems: mocks.items, listContentResources: mocks.resources }));
vi.mock("./course-material-embedding-settings", () => ({ lockCourseMaterialEmbeddingSettings: vi.fn() }));
vi.mock("./material-embeddings", () => ({ contentIndexRevision: (value: unknown) => JSON.stringify(value), createCourseEmbeddingProvider: mocks.provider, getMaterialIndexStatus: mocks.status, prepareMaterialIndex: mocks.prepare, getMaterialIndexPreview: vi.fn() }));
const { getActivityMaterialReferenceTree, getActivityMaterialReferences, saveActivityMaterialReferences, prepareActivityReferenceMaterial, finishActivityMaterialReferencePreparation } = await import("./activity-material-references");
const { AppError } = await import("./errors");
const user = { id: "manager", email: "manager@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] }, scope = { user, courseId: "course", activityId: "activity" };
const embeddingAi = { connectionId: "model", model: "vectors", dimensions: 8, endpointKey: "endpoint" };
const prepared = { id: "snapshot", selected: ["visible"], indexIds: ["visible-index"], hiddenReferenceIndexIds: [], embeddingAi, preparedByUserId: user.id, preparedAt: "2026-11-06T00:00:00Z", selectionFingerprint: "snapshot" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.activity.mockResolvedValue({ activityType: { key: "generic-consumer" } });
  const row = (id: string, position: number, kind: string, resourceId: string | null, visibility = "visible", parentId: string | null = null) => ({ id, position, kind, contentResourceId: resourceId, parentId, titleSnapshot: id, effectiveVisibility: visibility, activityId: id === "anchor" ? "activity" : null, createdAt: new Date(0) });
  mocks.items.mockResolvedValue([row("visible-item", 0, "content", "visible"), row("hidden-folder", 1, "folder", null, "hidden"), row("hidden-item", 0, "content", "hidden", "hidden_by_parent", "hidden-folder"), row("anchor", 2, "activity", null, "hidden"), row("later-item", 3, "content", "later")]);
  mocks.resources.mockResolvedValue(["visible", "hidden", "later"].map(id => ({ id, title: id })));
  mocks.read.mockResolvedValue({ selected: ["visible"], prepared, locked: false, revision: "revision" });
  mocks.provider.mockResolvedValue({ selection: embeddingAi, connectionId: "model", model: "vectors" });
  mocks.status.mockImplementation(async (_user, _course, id: string) => ({ state: "ready", index: { id: `${id}-index`, documentCount: 1, vectorDimensions: 8 } }));
  mocks.prepare.mockResolvedValue({ id: "visible-index" });
});
describe("shared activity material-reference service", () => {
  it("offers hidden descendants but defaults to visible preceding material even when the activity is hidden", async () => {
    const tree = await getActivityMaterialReferenceTree(scope);
    expect(tree.defaults).toEqual(["visible"]);
    expect(tree.rows.find(row => row.resourceId === "hidden")).toMatchObject({ hidden: true, parentId: "hidden-folder" });
    expect(tree.rows.some(row => row.kind === "activity")).toBe(false);
  });
  it("rejects a stale selection, a foreign material, and edits while the consumer is locked", async () => {
    await expect(saveActivityMaterialReferences(scope, { selected: ["visible"], revision: "stale" })).rejects.toMatchObject({ code: "ACTIVITY_REFERENCES_CHANGED" });
    await expect(saveActivityMaterialReferences(scope, { selected: ["foreign"] })).rejects.toMatchObject({ code: "MATERIAL_REFERENCE_INVALID" });
    mocks.read.mockResolvedValue({ selected: ["visible"], prepared, locked: true, revision: "revision" });
    await expect(saveActivityMaterialReferences(scope, { selected: ["hidden"] })).rejects.toMatchObject({ code: "ACTIVITY_REFERENCES_LOCKED" });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("dispatches preparation with the shared course model and records the explicit hidden subset", async () => {
    mocks.read.mockResolvedValue({ selected: ["visible", "hidden"], prepared: null, locked: false, revision: "revision" });
    await prepareActivityReferenceMaterial(scope, { resourceId: "hidden", revision: "revision" });
    expect(mocks.prepare).toHaveBeenCalledWith(user, "course", "hidden", expect.objectContaining(embeddingAi));
    await finishActivityMaterialReferencePreparation(scope, { revision: "revision" });
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ selected: ["visible", "hidden"], prepared: expect.objectContaining({ indexIds: ["visible-index", "hidden-index"], hiddenReferenceIndexIds: ["hidden-index"], embeddingAi, preparedByUserId: "manager" }) }));
  });
  it("invalidates future preparation after a course model change but preserves a locked snapshot", async () => {
    mocks.provider.mockResolvedValue({ selection: { ...embeddingAi, model: "new-vectors" }, connectionId: "model", model: "new-vectors" });
    expect((await getActivityMaterialReferences(scope)).prepared).toBe(false);
    mocks.read.mockResolvedValue({ selected: ["visible"], prepared, locked: true, revision: "revision" });
    expect((await getActivityMaterialReferences(scope)).prepared).toBe(true);
    expect(mocks.status).toHaveBeenLastCalledWith(user, "course", "later", embeddingAi);
  });
  it("does not publish incomplete reference preparation or expose authoring state to a learner", async () => {
    mocks.status.mockResolvedValue({ state: "missing", index: null });
    await expect(finishActivityMaterialReferencePreparation(scope)).rejects.toMatchObject({ code: "MATERIAL_EMBEDDINGS_REQUIRED" }); expect(mocks.write).not.toHaveBeenCalled();
    mocks.authorize.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    mocks.read.mockClear(); await expect(getActivityMaterialReferences(scope)).rejects.toMatchObject({ status: 403 }); expect(mocks.read).not.toHaveBeenCalled();
  });
});
