import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), manage: vi.fn(), user: vi.fn(), indexes: vi.fn(), items: vi.fn() }));
vi.mock("./material-embeddings", () => ({ createPreparedMaterialSearch: mocks.search }));
vi.mock("./authorization", () => ({ assertCanManageCourse: mocks.manage }));
vi.mock("./course-content", () => ({ listContentItems: mocks.items }));
vi.mock("@cognelo/db", () => ({ prisma: { user: { findUnique: mocks.user }, contentMaterialIndex: { findMany: mocks.indexes } } }));
const { AppError } = await import("./errors");
const { assertPreparedActivityReferencesReady, createPreparedActivityReferenceSearch } = await import("./material-reference-search");
const learner = { id: "learner", email: "learner@example.test", name: null, firstName: null, lastName: null, roles: ["student" as const] };
const scope = { user: learner, courseId: "course", groupId: "section" };
const snapshot = { indexIds: ["public", "hidden"], hiddenReferenceIndexIds: ["hidden"], preparedByUserId: "teacher" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, isActive: true, roles: [{ role: { key: "teacher" } }] });
  mocks.search.mockImplementation(async (_user, _course, ids: string[]) => ({ search: async () => ids.map(id => ({ title: id, text: `${id} content`, score: id === "hidden" ? 0.9 : 0.5 })) }));
  mocks.indexes.mockResolvedValue([{ resourceId: "public-material", resource: { title: "Public lesson" } }]);
  mocks.items.mockResolvedValue([{ contentResourceId: "public-material" }]);
});
describe("reference activation preflight", () => {
  it("checks every enabled section using learner visibility without querying a model", async () => {
    const query = vi.fn(); mocks.search.mockResolvedValue({ search: query });
    const groups = [{ id: "section-a", title: "Section A" }, { id: "empty-section", title: "Empty section" }];
    await assertPreparedActivityReferencesReady(scope, snapshot, groups);
    expect(mocks.items).toHaveBeenNthCalledWith(1, learner, "course", { groupId: "section-a", visibleOnly: true, learnerVisibility: true });
    expect(mocks.items).toHaveBeenNthCalledWith(2, learner, "course", { groupId: "empty-section", visibleOnly: true, learnerVisibility: true });
    expect(mocks.indexes).toHaveBeenCalledWith(expect.objectContaining({ where: { courseId: "course", id: { in: ["public"] } } }));
    expect(query).not.toHaveBeenCalled();
  });
  it("names section-hidden public references instead of granting private access", async () => {
    mocks.items.mockResolvedValueOnce([{ contentResourceId: "public-material" }]).mockResolvedValueOnce([]);
    await expect(assertPreparedActivityReferencesReady(scope, snapshot, [{ id: "section-a", title: "Section A" }, { id: "section-b", title: "Section B" }])).rejects.toMatchObject({
      status: 409, code: "ACTIVITY_REFERENCE_ACCESS_REQUIRED", message: expect.stringContaining("“Public lesson” (Section B)"),
      details: { issues: [{ groupId: "section-b", groupTitle: "Section B", resourceId: "public-material", materialTitle: "Public lesson" }] }
    });
  });
  it("checks General before assigning sections and preserves intentionally retained indexes", async () => {
    mocks.indexes.mockResolvedValue([{ resourceId: null, resource: null }]);
    await assertPreparedActivityReferencesReady(scope, { indexIds: ["retained"] }, []);
    expect(mocks.items).toHaveBeenCalledWith(learner, "course", { groupId: undefined, visibleOnly: true, learnerVisibility: true });
  });
  it("propagates stored search configuration failures before checking visibility", async () => {
    mocks.search.mockRejectedValue(new AppError(409, "EMBEDDING_INDEX_INCOMPATIBLE", "Incompatible vectors"));
    await expect(assertPreparedActivityReferencesReady(scope, snapshot, [])).rejects.toMatchObject({ code: "EMBEDDING_INDEX_INCOMPATIBLE" });
    expect(mocks.items).not.toHaveBeenCalled();
  });
});
describe("explicitly prepared hidden homework references", () => {
  it("preserves learner visibility checks for legacy and public references", async () => {
    const search = await createPreparedActivityReferenceSearch(scope, { indexIds: ["public"] });
    expect(await search.search("code")).toMatchObject([{ title: "public" }]);
    expect(mocks.search).toHaveBeenCalledWith(learner, "course", ["public"], "section", undefined);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.manage).not.toHaveBeenCalled();
  });
  it("authorizes only the prepared hidden subset through its current course manager", async () => {
    const search = await createPreparedActivityReferenceSearch(scope, snapshot);
    expect(mocks.search).toHaveBeenNthCalledWith(1, learner, "course", ["public"], "section", undefined);
    expect(mocks.manage).toHaveBeenCalledWith(expect.objectContaining({ id: "teacher" }), "course");
    expect(mocks.search).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "teacher" }), "course", ["hidden"], "section", undefined);
    expect(await search.search("code", 1)).toEqual([{ title: "hidden", text: "hidden content", score: 0.9 }]);
  });
  it.each([null, { isActive: false }])("fails closed without an active preparing account", async account => {
    mocks.user.mockResolvedValue(account);
    await expect(createPreparedActivityReferenceSearch(scope, snapshot)).rejects.toMatchObject({ code: "MATERIAL_PRIVATE_REFERENCES_UNAVAILABLE" });
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });
  it("rechecks management permission and does not bypass revocation", async () => {
    mocks.manage.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(createPreparedActivityReferenceSearch(scope, snapshot)).rejects.toMatchObject({ status: 403 });
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });
  it("rejects hidden indexes outside the immutable selection", async () => {
    await expect(createPreparedActivityReferenceSearch(scope, { ...snapshot, hiddenReferenceIndexIds: ["foreign"] })).rejects.toMatchObject({ code: "MATERIAL_PRIVATE_REFERENCES_UNAVAILABLE" });
    expect(mocks.search).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled();
  });
});
