import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  active: vi.fn(), changed: vi.fn(), withdraw: vi.fn(), enqueue: vi.fn(),
  tx: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), $queryRawUnsafe: vi.fn(), studentGrouping: { findFirst: vi.fn() }, activity: { findMany: vi.fn() }, courseGroupParticipant: { findMany: vi.fn() }, activityAttempt: { findFirst: vi.fn(), findMany: vi.fn() }, courseAuditEvent: { create: vi.fn() }, grade: { findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() }, gradeEvent: { create: vi.fn() } }
}));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: (key: string) => ({ supportsTeamwork: key === "team-capable" }) }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivityTeamworkHandler: () => ({ hasActiveSubmissions: mocks.active, membershipChanged: mocks.changed }) }));
vi.mock("./background-jobs", () => ({ enqueueBackgroundJob: mocks.enqueue }));
vi.mock("./gradebook", () => ({ deleteActivitySubmission: mocks.withdraw }));
const { validateActivityTeamworkChange, notifyActivityTeamMembershipChanges, resolveActivityTeamContext } = await import("./activity-teamwork");
const user = { id: "user", email: "student@example.test", roles: ["student" as const], name: null, firstName: null, lastName: null };
const tx = mocks.tx as never;
beforeEach(() => {
  vi.resetAllMocks(); mocks.tx.activityAttempt.findMany.mockResolvedValue([]); mocks.tx.$queryRaw.mockResolvedValue([]); mocks.active.mockResolvedValue(false); mocks.changed.mockResolvedValue({});
  mocks.tx.studentGrouping.findFirst.mockResolvedValue({ id: "grouping" });
  mocks.tx.activity.findMany.mockResolvedValue([{ id: "activity", activityType: { key: "team-capable" } }]);
  mocks.tx.courseGroupParticipant.findMany.mockResolvedValue([{ id: "student", userId: "user" }]);
});
describe("core team activity policy", () => {
  it("rejects unsupported activities and groupings from another section", async () => {
    await expect(validateActivityTeamworkChange(tx, { activityId: "activity", activityTypeKey: "individual", previousEnabled: false, enabled: true })).rejects.toMatchObject({ code: "ACTIVITY_TEAMWORK_UNSUPPORTED" });
    mocks.tx.studentGrouping.findFirst.mockResolvedValue(null);
    await expect(validateActivityTeamworkChange(tx, { activityId: "activity", activityTypeKey: "team-capable", groupId: "section", previousEnabled: false, enabled: true, next: { groupingId: "foreign", allowIndividualSubmission: false } })).rejects.toMatchObject({ code: "ACTIVITY_TEAM_GROUPING_REQUIRED" });
    expect(mocks.tx.studentGrouping.findFirst).toHaveBeenCalledWith({ where: { id: "foreign", groupId: "section" }, select: { id: true } });
  });
  it("locks changed team policies after hand-in but permits unchanged policies", async () => {
    mocks.active.mockResolvedValue(true);
    const config = { activityId: "activity", activityTypeKey: "team-capable", groupId: "section", previousEnabled: true, enabled: true,
      previous: { groupingId: "grouping", allowIndividualSubmission: false }, next: { groupingId: "grouping", allowIndividualSubmission: true } };
    await expect(validateActivityTeamworkChange(tx, config)).rejects.toMatchObject({ code: "ACTIVITY_TEAMWORK_LOCKED" });
    await expect(validateActivityTeamworkChange(tx, { ...config, next: config.previous })).resolves.toBeUndefined();
  });
  it("resolves only the current enrollment/team and retains per-section unteamed policy", async () => {
    mocks.tx.$queryRaw.mockResolvedValueOnce([{ participantId: "student", activityTypeKey: "team-capable", activityMetadata: { allGroupsAssignment: { teamworkEnabled: true } }, metadata: { teamwork: { groupingId: "grouping", allowIndividualSubmission: false } } }])
      .mockResolvedValueOnce([{ visibleToStudents: false }]).mockResolvedValueOnce([]);
    expect(await resolveActivityTeamContext(user, "course", "section", "activity", tx)).toMatchObject({ enabled: true, groupingId: "grouping", teamId: null, allowIndividualSubmission: false, visibleToStudents: false });
    mocks.tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(resolveActivityTeamContext(user, "other", "section", "activity", tx)).rejects.toMatchObject({ code: "ACTIVITY_TEAM_ENROLLMENT_REQUIRED" });
  });
  it("does not reset work when only grouping/team names change", async () => {
    const members = [{ teamId: "team", participantIds: ["student"] }];
    await notifyActivityTeamMembershipChanges(tx, user, "course", "section", "grouping", members, members);
    expect(mocks.changed).not.toHaveBeenCalled(); expect(mocks.tx.activity.findMany).not.toHaveBeenCalled();
  });
  it("withdraws a manual grade even when challenge answering has not created an attempt", async () => {
    mocks.tx.activity.findMany.mockResolvedValue([{ id: "activity", activityType: { key: "team-capable" }, metadata: { allGroupsAssignment: { teamworkEnabled: true } }, groupAssignments: [{ metadata: { teamwork: { groupingId: "grouping" } } }] }]);
    mocks.tx.grade.findMany.mockResolvedValue([{ gradebookItemId: "item", participantId: "student" }]);
    mocks.tx.grade.findUnique.mockResolvedValue({ id: "grade", normalizedScore: 75 });
    await notifyActivityTeamMembershipChanges(tx, user, "course", "section", "grouping", [{ teamId: "old", participantIds: ["student"] }], []);
    expect(mocks.tx.gradeEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ previousValue: { id: "grade", normalizedScore: 75 }, nextValue: { grade: null } }) }));
    expect(mocks.tx.grade.delete).toHaveBeenCalledWith({ where: { id: "grade" } });
  });
  it("delegates the exact membership move/empty team and withdraws only scoped attempts", async () => {
    mocks.changed.mockResolvedValue({ withdrawAttemptIds: ["old-attempt", "old-attempt", "foreign"] });
    mocks.tx.activityAttempt.findFirst.mockResolvedValueOnce({ id: "old-attempt" }).mockResolvedValueOnce(null);
    await notifyActivityTeamMembershipChanges(tx, user, "course", "section", "grouping", [{ teamId: "old", participantIds: ["student"] }], [{ teamId: "new", participantIds: ["student"] }]);
    expect(mocks.changed).toHaveBeenCalledWith(expect.objectContaining({ activityId: "activity", emptyTeamIds: ["old"], changes: [{ participantId: "student", userId: "user", previousTeamId: "old", teamId: "new" }] }));
    expect(mocks.withdraw).toHaveBeenCalledTimes(1);
    expect(mocks.withdraw).toHaveBeenCalledWith(user, "course", expect.objectContaining({ attemptId: "old-attempt" }), expect.objectContaining({ transaction: tx, membershipChange: { groupId: "section", participantIds: ["student"] } }));
  });
});
