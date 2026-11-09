import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  stage: vi.fn(), handIn: vi.fn(), manage: vi.fn(), grade: vi.fn(),
  core: { activity: { findFirst: vi.fn() }, user: { findMany: vi.fn() }, $queryRaw: vi.fn() },
  plugin: { pluginCodingHomeworkAssignment: { findUnique: vi.fn() } }
}));
vi.mock("@cognelo/core", async original => ({ ...await original<typeof import("@cognelo/core")>(), assertCanManageCourse: mocks.manage, assertCanGradeGroup: mocks.grade }));
vi.mock("@cognelo/db", () => ({ prisma: mocks.core }));
vi.mock("./db-client", () => ({ prisma: mocks.plugin }));
vi.mock("./stage-scheduling", () => ({ homeworkFileStageSettings: mocks.stage }));
vi.mock("./hand-in", () => ({ handInHomework: mocks.handIn }));
vi.mock("./file-preparation", () => ({ record: (value: unknown) => value && typeof value === "object" ? value : {} }));
const { AppError } = await import("@cognelo/core");
const { recoverHomeworkForClass, recoverHomeworkForStudent } = await import("./automatic-hand-in");
const user = { id: "teacher", email: "teacher@example.test", name: "Teacher", firstName: null, lastName: null, roles: ["teacher" as const] };
const scope = { user, courseId: "course", activityId: "activity" };
const settings = { submissionsEnabled: true, submissionPolicy: { deadline: "2020-01-01T12:00:00.000Z", allowLate: false } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.stage.mockResolvedValue({ submissionClosesAt: settings.submissionPolicy.deadline });
  mocks.plugin.pluginCodingHomeworkAssignment.findUnique.mockResolvedValue({ settings });
  mocks.core.activity.findFirst.mockResolvedValue({ metadata: {} });
  mocks.core.$queryRaw.mockResolvedValue([{ id: "draft-a", groupId: "section", userId: "a", revision: 2 }, { id: "draft-b", groupId: "section", userId: "b", revision: 3 }]);
  mocks.core.user.findMany.mockResolvedValue(["a", "b"].map(id => ({ id, email: `${id}@example.test`, name: id, firstName: null, lastName: null, roles: [{ role: { key: "student" } }] })));
});
describe("automatic homework recovery scope and failures", () => {
  it("continues processing other saved copies after an integrity failure", async () => {
    mocks.handIn.mockRejectedValueOnce(new AppError(409, "HOMEWORK_FILE_CHANGED", "A saved file could not be verified.")).mockResolvedValueOnce(null);
    const issues = await recoverHomeworkForClass(scope, "section");
    expect(mocks.grade).toHaveBeenCalledWith(user, "course", "section");
    expect(issues).toEqual([{ student: "a", code: "HOMEWORK_FILE_CHANGED", message: "A saved file could not be verified." }]);
    expect(mocks.handIn).toHaveBeenCalledTimes(2);
    expect(mocks.handIn).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: "section", user: expect.objectContaining({ id: "b" }) }), { expectedRevision: 3, acknowledgeIncomplete: true }, { cutoff: settings.submissionPolicy.deadline, triggeredBy: user.id });
  });
  it("requires staff authorization before loading or recovering a class", async () => {
    mocks.manage.mockRejectedValue(new AppError(403, "FORBIDDEN", "Forbidden"));
    await expect(recoverHomeworkForClass(scope)).rejects.toMatchObject({ status: 403 });
    expect(mocks.core.$queryRaw).not.toHaveBeenCalled(); expect(mocks.handIn).not.toHaveBeenCalled();
  });
  it.each([
    { ...settings, submissionsEnabled: false },
    { submissionsEnabled: true },
    { submissionsEnabled: true, submissionPolicy: { ...settings.submissionPolicy, allowLate: true, lateLimitMinutes: null } }
  ])("does not recover without an enabled finite cutoff", async value => {
    mocks.plugin.pluginCodingHomeworkAssignment.findUnique.mockResolvedValue({ settings: value });
    mocks.stage.mockResolvedValue({ submissionClosesAt: null });
    expect(await recoverHomeworkForClass(scope)).toEqual([]);
    expect(mocks.handIn).not.toHaveBeenCalled();
  });
  it("keeps the learner recovery query scoped to their enrollment", async () => {
    mocks.core.$queryRaw.mockResolvedValue([]);
    await recoverHomeworkForStudent({ ...scope, user: { ...user, id: "learner" }, groupId: "my-section" });
    const values = mocks.core.$queryRaw.mock.calls[0].slice(1);
    expect(values).toContain("learner"); expect(values).toContain("my-section");
  });
  it("does not turn a concurrent hand-in or teacher cancellation into a failure notice", async () => {
    mocks.handIn.mockRejectedValueOnce(new AppError(409, "HOMEWORK_FILES_FROZEN", "Already submitted")).mockRejectedValueOnce(new AppError(409, "HOMEWORK_AUTOMATIC_CANCELLED", "Cancelled"));
    expect(await recoverHomeworkForClass(scope)).toEqual([]);
  });
});
