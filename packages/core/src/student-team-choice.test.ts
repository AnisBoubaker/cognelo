import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";

const mocks = vi.hoisted(() => ({
  courseGroupParticipant: { findFirst: vi.fn() },
  studentGrouping: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  studentTeamMember: { upsert: vi.fn() }, courseAuditEvent: { create: vi.fn() }, transaction: vi.fn()
}));
vi.mock("@cognelo/db", async (original) => ({ ...await original<typeof import("@cognelo/db")>(), prisma: { ...mocks, $transaction: mocks.transaction } }));
const { chooseStudentTeam, listMyStudentGroupings, studentTeamChoiceState } = await import("./student-team-choice");
const user: CurrentUser = { id: "learner", email: "learner@example.test", roles: ["student"], name: null, firstName: null, lastName: null };
const now = new Date("2026-10-12T12:00:00.000Z");
const policy = { studentChoiceEnabled: true, choiceOpensAt: new Date("2026-10-12T11:00:00.000Z"), choiceClosesAt: now, allowChoiceChanges: true };
const grouping = () => ({
  ...policy, choiceClosesAt: new Date("2026-10-12T13:00:00.000Z"), id: "grouping", groupId: "section", title: "Projects", description: "Private accommodation notes", revision: 7,
  teams: [
    { id: "a", title: "A", capacity: 2, members: [{ participantId: "student", participant: { firstName: "Sam", lastName: "Student", email: "private@example.test" } }] },
    { id: "b", title: "B", capacity: 1, members: [] }
  ]
});

describe("student selection window", () => {
  it("opens at the start and closes at the exact deadline, even with changes allowed", () => {
    expect(studentTeamChoiceState(policy, true, new Date("2026-10-12T10:59:59.999Z"))).toBe("upcoming");
    expect(studentTeamChoiceState(policy, true, policy.choiceOpensAt)).toBe("open");
    expect(studentTeamChoiceState(policy, true, new Date(now.getTime() - 1))).toBe("open");
    expect(studentTeamChoiceState(policy, true, now)).toBe("closed");
    expect(studentTeamChoiceState(policy, false, new Date(now.getTime() + 1))).toBe("closed");
  });
  it("locks an existing choice independently of dates and supports open-ended windows", () => {
    const unlimited = { ...policy, choiceOpensAt: null, choiceClosesAt: null, allowChoiceChanges: false };
    expect(studentTeamChoiceState(unlimited, true, now)).toBe("locked");
    expect(studentTeamChoiceState(unlimited, false, now)).toBe("open");
    expect(studentTeamChoiceState({ ...unlimited, studentChoiceEnabled: false }, false, now)).toBe("disabled");
  });
});

describe("student team choice authorization and atomicity", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now);
    mocks.transaction.mockImplementation(async (callback: (tx: typeof mocks) => unknown) => callback(mocks));
    mocks.courseGroupParticipant.findFirst.mockResolvedValue({ id: "student", group: { status: "published", availableFrom: null, availableUntil: null } });
    mocks.studentGrouping.findFirst.mockResolvedValue(grouping());
    mocks.studentGrouping.findMany.mockResolvedValue([grouping()]);
    mocks.studentGrouping.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => vi.useRealTimers());
  const choose = (teamId = "b") => chooseStudentTeam(user, "course", "section", "grouping", { teamId });

  it.each(["list", "choose"])("requires an actual student enrollment for %s, scoped to the course and section", async (operation) => {
    mocks.courseGroupParticipant.findFirst.mockResolvedValue(null);
    await expect(operation === "list" ? listMyStudentGroupings(user, "course", "section") : choose()).rejects.toMatchObject({ status: 403 });
    expect(mocks.courseGroupParticipant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: user.id, groupId: "section", role: "student", group: { courseId: "course" } } }));
    expect(mocks.studentGrouping.findMany).not.toHaveBeenCalled();
    expect(mocks.studentTeamMember.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { status: "draft", availableFrom: null, availableUntil: null },
    { status: "published", availableFrom: new Date(now.getTime() + 1), availableUntil: null },
    { status: "published", availableFrom: null, availableUntil: new Date(now.getTime() - 1) }
  ])("blocks choices in an unavailable section", async (group) => {
    mocks.courseGroupParticipant.findFirst.mockResolvedValue({ id: "student", group });
    await expect(choose()).rejects.toMatchObject({ code: "GROUP_NOT_AVAILABLE" });
    expect(mocks.studentTeamMember.upsert).not.toHaveBeenCalled();
  });
  it("returns names only and hides other teams in manual groupings", async () => {
    mocks.studentGrouping.findMany.mockResolvedValue([{ ...grouping(), studentChoiceEnabled: false }]);
    const { groupings } = await listMyStudentGroupings(user, "course", "section");
    expect(groupings[0]).toMatchObject({ title: "Projects", ownTeamId: "a", choiceState: "disabled", teams: [{ id: "a", members: [{ name: "Sam Student", isSelf: true }] }] });
    expect(groupings[0]!.teams).toHaveLength(1);
    expect(groupings[0]).not.toHaveProperty("description");
    expect(groupings[0]).not.toHaveProperty("revision");
    expect(JSON.stringify(groupings)).not.toContain("private@example.test");
    expect(groupings[0]!.teams[0]!.members[0]).not.toHaveProperty("participantId");
  });
  it("shows all selectable teams without exposing private grouping data", async () => {
    const { groupings } = await listMyStudentGroupings(user, "course", "section");
    expect(groupings[0]!.teams).toHaveLength(2);
    expect(groupings[0]!.choiceState).toBe("open");
    expect(JSON.stringify(groupings)).not.toContain("Private accommodation");
  });
  it("changes membership, advances the teacher revision, and records the actor in one serializable transaction", async () => {
    await expect(choose()).resolves.toEqual({ ok: true });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.studentGrouping.updateMany).toHaveBeenCalledWith({ where: { id: "grouping", groupId: "section", revision: 7 }, data: { revision: { increment: 1 } } });
    expect(mocks.studentTeamMember.upsert).toHaveBeenCalledWith({ where: { groupingId_participantId: { groupingId: "grouping", participantId: "student" } }, create: { groupingId: "grouping", participantId: "student", teamId: "b" }, update: { teamId: "b" } });
    expect(mocks.courseAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: user.id, previousValue: { participantId: "student", teamId: "a" }, nextValue: { participantId: "student", teamId: "b" } }) });
  });
  it.each([
    { studentChoiceEnabled: false }, { choiceOpensAt: new Date(now.getTime() + 1) }, { choiceClosesAt: now }, { choiceClosesAt: new Date(now.getTime() - 1) }
  ])("rejects a selection or change outside the selection window", async (change) => {
    mocks.studentGrouping.findFirst.mockResolvedValue({ ...grouping(), ...change });
    await expect(choose()).rejects.toMatchObject({ status: 403, code: "STUDENT_TEAM_CHOICE_NOT_OPEN" });
    await expect(choose("a")).rejects.toMatchObject({ status: 403, code: "STUDENT_TEAM_CHOICE_NOT_OPEN" });
    expect(mocks.studentTeamMember.upsert).not.toHaveBeenCalled();
  });
  it("rejects changing a locked choice but allows an idempotent confirmation during the window", async () => {
    mocks.studentGrouping.findFirst.mockResolvedValue({ ...grouping(), allowChoiceChanges: false });
    await expect(choose()).rejects.toMatchObject({ status: 403, code: "STUDENT_TEAM_CHOICE_LOCKED" });
    await expect(choose("a")).resolves.toEqual({ ok: true });
    expect(mocks.studentTeamMember.upsert).not.toHaveBeenCalled();
  });
  it("rejects full or foreign teams without removing the current membership", async () => {
    const stored = grouping(); stored.teams[1]!.capacity = 0;
    mocks.studentGrouping.findFirst.mockResolvedValue(stored);
    await expect(choose()).rejects.toMatchObject({ status: 409, code: "STUDENT_TEAM_FULL" });
    await expect(choose("foreign")).rejects.toMatchObject({ status: 404 });
    expect(mocks.studentTeamMember.upsert).not.toHaveBeenCalled();
  });
  it("scopes grouping lookup to the student's section", async () => {
    mocks.studentGrouping.findFirst.mockResolvedValue(null);
    await expect(choose()).rejects.toMatchObject({ status: 404 });
    expect(mocks.studentGrouping.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "grouping", groupId: "section" } }));
  });
  it("rejects client-supplied student identities", async () => {
    await expect(chooseStudentTeam(user, "course", "section", "grouping", { teamId: "b", participantId: "someone-else" })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects a lost revision race before updating membership", async () => {
    mocks.studentGrouping.updateMany.mockResolvedValue({ count: 0 });
    await expect(choose()).rejects.toMatchObject({ status: 409, code: "STUDENT_TEAM_CHOICE_CONFLICT" });
    expect(mocks.studentTeamMember.upsert).not.toHaveBeenCalled();
  });
  it.each(["P2034", "P2002", "P2003", "P2025"])("turns transaction conflict %s into a retryable choice response", async (code) => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Conflict", { code, clientVersion: "test" }));
    await expect(choose()).rejects.toMatchObject({ status: 409, code: "STUDENT_TEAM_CHOICE_CONFLICT" });
  });
});
