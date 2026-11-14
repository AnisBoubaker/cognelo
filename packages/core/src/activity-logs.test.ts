import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scope: vi.fn(), service: vi.fn(), starts: vi.fn(), grades: vi.fn(), users: vi.fn(), archived: vi.fn() }));
vi.mock("./activity-report-scope", () => ({ activityReportScope: mocks.scope }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivityReportService: mocks.service }));
vi.mock("@cognelo/db", () => ({ prisma: { $queryRaw: mocks.archived, activityAttempt: { findMany: mocks.starts }, gradeEvent: { findMany: mocks.grades }, user: { findMany: mocks.users } } }));
import { activityLogBefore, listActivityLogs } from "./activity-logs";
const user = {} as never;
const at = "2026-11-14T12:00:00.000Z";
describe("shared activity logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scope.mockResolvedValue({ activity: { activityType: { key: "example" } }, participants: [{ participantId: "p", groupId: "g", name: "Current name", groupTitle: "Section" }] });
    mocks.service.mockReturnValue(null); mocks.starts.mockResolvedValue([]); mocks.grades.mockResolvedValue([]); mocks.users.mockResolvedValue([]); mocks.archived.mockResolvedValue([]);
  });
  it("merges chronological sources, scopes identities and projects only public evidence", async () => {
    mocks.service.mockReturnValue({ logs: vi.fn().mockResolvedValue([
      { id: "homework:1", at, type: "files_submitted", groupId: "g", participantId: "p", actorUserId: "teacher", reason: "Fix work", rawSource: "PRIVATE" },
      { id: "foreign", at, type: "files_submitted", groupId: "other", participantId: "foreign" }
    ]) });
    mocks.starts.mockResolvedValueOnce([{ id: "a", participantId: "p", groupId: "g", startedAt: new Date(at), userId: "teacher", attemptNumber: 1 }]);
    mocks.users.mockResolvedValue([{ id: "teacher", firstName: "New", lastName: "Teacher", name: "Old", email: "email" }]);
    const page = await listActivityLogs(user, "course", "activity", { groupId: "g", limit: 1 });
    expect(page.entries).toHaveLength(1); expect(page.entries[0]).toMatchObject({ id: "start:a", student: "Current name", actor: "New Teacher" });
    expect(page.nextCursor).toEqual({ at, id: "start:a" });
    mocks.starts.mockResolvedValue([]);
    const next = await listActivityLogs(user, "course", "activity", { before: page.nextCursor! });
    expect(next.entries.map(entry => entry.id)).toEqual(["homework:1"]);
    expect(JSON.stringify(next)).not.toContain("PRIVATE"); expect(JSON.stringify(next)).not.toContain("actorUserId");
    expect(mocks.grades).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ participantId: { in: ["p"] }, gradebookItem: { courseId: "course", activityId: "activity" } }) }));
  });
  it("handles cursor ties within and across sources", () => {
    expect(activityLogBefore("createdAt", "grade:", { at, id: "grade:abc" })).toMatchObject({ OR: [{ createdAt: { lt: new Date(at) } }, { createdAt: new Date(at), id: { lt: "abc" } }] });
    expect(activityLogBefore("createdAt", "grade:", { at, id: "start:abc" }).OR).toHaveLength(2);
    expect(activityLogBefore("createdAt", "grade:", { at, id: "aaa" }).OR).toHaveLength(1);
  });
  it("returns an empty page for an empty authorized roster without querying evidence", async () => {
    mocks.scope.mockResolvedValue({ participants: [] });
    expect(await listActivityLogs(user, "course", "activity")).toEqual({ entries: [], nextCursor: null });
    expect(mocks.starts).not.toHaveBeenCalled();
  });
  it("retains the prior completion from reopening audit without returning its private snapshots", async () => {
    mocks.archived.mockResolvedValue([{ id: "archive:event", at: new Date(at), participantId: "p", groupId: "g", actorUserId: null, attemptNumber: 1 }]);
    expect((await listActivityLogs(user, "course", "activity")).entries[0]).toMatchObject({ type: "submitted", id: "archive:event", at });
  });
});
