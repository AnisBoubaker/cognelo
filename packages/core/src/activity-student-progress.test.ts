import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  courseGroupActivity: { findMany: vi.fn() }, activityAttempt: { findMany: vi.fn() },
  activityResponseDraft: { findMany: vi.fn() }, activityConversation: { findMany: vi.fn() }
}));
const auth = vi.hoisted(() => vi.fn());
vi.mock("@cognelo/db", () => ({ prisma: db }));
vi.mock("./authorization", () => ({ assertCanViewCourseGradebook: auth }));
vi.mock("./gradebook", () => ({ assignmentAssessmentMode: (m: { assessmentMode?: string }) => m?.assessmentMode?.startsWith("formative") ? "formative" : "summative" }));
vi.mock("./test-timeout-recovery", () => ({ recoverExpiredTestAttempts: vi.fn() }));
import { getCourseActivityProgress } from "./activity-student-progress";
const user = { id: "teacher", email: "teacher@example.test", name: "Teacher", firstName: "Test", lastName: "Teacher", roles: ["teacher"] } as const;
const started = new Date("2026-11-14T12:00:00Z"), submitted = new Date("2026-11-14T12:10:00Z"), later = new Date("2026-11-14T12:11:00Z");
const attempt = (extra = {}) => ({ participantId: "student", groupId: "group", groupActivityId: "assignment", assessmentMode: "summative", lifecycle: "submitted", attemptNumber: 1, startedAt: started, submittedAt: submitted, ...extra });
describe("activity student participation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); auth.mockResolvedValue({ gradingGroupIds: null });
    db.courseGroupActivity.findMany.mockResolvedValue([{ id: "assignment", groupId: "group", metadata: {}, activity: { metadata: {}, activityType: { key: "mcq" } }, group: { participants: [{ id: "student", userId: "account" }, { id: "pending", userId: null }] } }]);
    db.activityAttempt.findMany.mockResolvedValue([]); db.activityResponseDraft.findMany.mockResolvedValue([]); db.activityConversation.findMany.mockResolvedValue([]);
  });
  it("reports not started, untimed presence, completed work, and newly saved work without grading or answer content", async () => {
    const load = () => getCourseActivityProgress({ ...user, roles: ["teacher"] }, "course", "activity");
    expect((await load()).progress.map(p => p.state)).toEqual(["not_started", "not_started"]);
    db.activityConversation.findMany.mockResolvedValue([{ participantId: "student", groupActivityId: "assignment", lastSeenAt: started }]);
    expect((await load()).progress[0].state).toBe("in_progress");
    db.activityAttempt.findMany.mockResolvedValue([attempt()]);
    // Even a later heartbeat cannot undo completion.
    db.activityConversation.findMany.mockResolvedValue([{ participantId: "student", groupActivityId: "assignment", lastSeenAt: later }]);
    expect((await load()).progress[0].state).toBe("done");
    db.activityResponseDraft.findMany.mockResolvedValue([{ participantId: "student", groupActivityId: "assignment", updatedAt: later }]);
    expect((await load()).progress[0].state).toBe("in_progress");
    expect(db.activityResponseDraft.findMany.mock.calls[0][0].select).not.toHaveProperty("state");
  });
  it("retains attempt numbers/times and ignores attempts from an old assessment mode", async () => {
    db.activityAttempt.findMany.mockResolvedValue([attempt({ lifecycle: "started", submittedAt: null, attemptNumber: 2 }), attempt()]);
    const result = await getCourseActivityProgress({ ...user, roles: ["teacher"] }, "course", "activity");
    expect(result.progress[0]).toMatchObject({ state: "in_progress", attemptNumber: 2, startedAt: started.toISOString() });
    expect(result.attempts).toHaveLength(1);
    db.activityAttempt.findMany.mockResolvedValue([attempt({ assessmentMode: "formative" })]);
    expect((await getCourseActivityProgress({ ...user, roles: ["teacher"] }, "course", "activity")).progress[0].state).toBe("not_started");
  });
  it("does not count an offline broadcast as starting work", async () => {
    db.activityConversation.findMany.mockResolvedValue([{ participantId: "student", groupActivityId: "assignment", lastSeenAt: new Date(0) }]);
    expect((await getCourseActivityProgress({ ...user, roles: ["teacher"] }, "course", "activity")).progress[0].state).toBe("not_started");
  });
  it("rejects another section before querying and scopes the roster to assigned grading sections", async () => {
    auth.mockResolvedValue({ gradingGroupIds: ["group"] });
    await expect(getCourseActivityProgress({ ...user, roles: ["teacher"] }, "course", "activity", "other")).rejects.toMatchObject({ status: 403 });
    expect(db.courseGroupActivity.findMany).not.toHaveBeenCalled();
    await getCourseActivityProgress({ ...user, roles: ["teacher"] }, "course", "activity");
    expect(db.courseGroupActivity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { activityId: "activity", group: { courseId: "course" }, groupId: { in: ["group"] } } }));
  });
});
