import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), manage: vi.fn(), user: vi.fn() }));
vi.mock("@cognelo/core", async original => ({ ...await original<typeof import("@cognelo/core")>(), createPreparedMaterialSearch: mocks.search, assertCanManageCourse: mocks.manage }));
vi.mock("@cognelo/db", () => ({ prisma: { user: { findUnique: mocks.user } } }));
vi.mock("./file-preparation", () => ({ record: (value: unknown) => value && typeof value === "object" ? value : {} }));
const { AppError } = await import("@cognelo/core");
const { createHomeworkReferenceSearch } = await import("./prepared-reference-search");
const learner = { id: "learner", email: "learner@example.test", name: null, firstName: null, lastName: null, roles: ["student" as const] };
const scope = { user: learner, courseId: "course", groupId: "section" };
const snapshot = { indexIds: ["public", "hidden"], hiddenReferenceIndexIds: ["hidden"], preparedByUserId: "teacher" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, isActive: true, roles: [{ role: { key: "teacher" } }] });
  mocks.search.mockImplementation(async (_user, _course, ids: string[]) => ({ search: async () => ids.map(id => ({ title: id, text: `${id} content`, score: id === "hidden" ? 0.9 : 0.5 })) }));
});
describe("explicitly prepared hidden homework references", () => {
  it("preserves learner visibility checks for legacy and public references", async () => {
    const search = await createHomeworkReferenceSearch(scope, { indexIds: ["public"] });
    expect(await search.search("code")).toMatchObject([{ title: "public" }]);
    expect(mocks.search).toHaveBeenCalledWith(learner, "course", ["public"], "section", undefined);
    expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.manage).not.toHaveBeenCalled();
  });
  it("authorizes only the prepared hidden subset through its current course manager", async () => {
    const search = await createHomeworkReferenceSearch(scope, snapshot);
    expect(mocks.search).toHaveBeenNthCalledWith(1, learner, "course", ["public"], "section", undefined);
    expect(mocks.manage).toHaveBeenCalledWith(expect.objectContaining({ id: "teacher" }), "course");
    expect(mocks.search).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "teacher" }), "course", ["hidden"], "section", undefined);
    expect(await search.search("code", 1)).toEqual([{ title: "hidden", text: "hidden content", score: 0.9 }]);
  });
  it.each([null, { isActive: false }])("fails closed without an active preparing account", async account => {
    mocks.user.mockResolvedValue(account);
    await expect(createHomeworkReferenceSearch(scope, snapshot)).rejects.toMatchObject({ code: "HOMEWORK_PRIVATE_REFERENCES_UNAVAILABLE" });
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });
  it("rechecks management permission and does not bypass revocation", async () => {
    mocks.manage.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(createHomeworkReferenceSearch(scope, snapshot)).rejects.toMatchObject({ status: 403 });
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });
  it("rejects hidden indexes outside the immutable selection", async () => {
    await expect(createHomeworkReferenceSearch(scope, { ...snapshot, hiddenReferenceIndexIds: ["foreign"] })).rejects.toMatchObject({ code: "HOMEWORK_PRIVATE_REFERENCES_UNAVAILABLE" });
    expect(mocks.search).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled();
  });
});
