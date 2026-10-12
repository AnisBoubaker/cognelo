import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  courseGroup: { findFirst: vi.fn() },
  courseGroupParticipant: { findMany: vi.fn() },
  studentGrouping: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  studentTeam: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  studentTeamMember: { createMany: vi.fn(), deleteMany: vi.fn() },
  courseAuditEvent: { create: vi.fn() },
  transaction: vi.fn()
}));
vi.mock("@cognelo/db", async (importOriginal) => ({
  ...await importOriginal<typeof import("@cognelo/db")>(),
  prisma: { ...mocks, $transaction: mocks.transaction }
}));
vi.mock("./authorization", () => ({ assertCanManageGroupRoster: mocks.authorize }));
const { createStudentGrouping, listStudentGroupings, updateStudentGrouping, deleteStudentGrouping } = await import("./student-groupings");
const user: CurrentUser = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] };
const stored = () => ({
  id: "grouping", groupId: "section", title: "Project teams", description: "", revision: 1,
  teams: [{ id: "team", title: "Team A", members: [{ participantId: "student" }] }]
});
const input = { title: "Project teams", teams: [{ title: "Team A", participantIds: ["student"] }] };
const update = { ...input, revision: 1, teams: [{ ...input.teams[0]!, id: "team" }] };
const knownError = (code: string) => new Prisma.PrismaClientKnownRequestError("Database conflict", { code, clientVersion: "test" });

describe("section student groupings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: typeof mocks) => unknown) => callback(mocks));
    mocks.courseGroup.findFirst.mockResolvedValue({ id: "section" });
    mocks.courseGroupParticipant.findMany.mockResolvedValue([{ id: "student" }]);
    mocks.studentGrouping.findMany.mockResolvedValue([stored()]);
    mocks.studentGrouping.findFirst.mockResolvedValue(stored());
    mocks.studentGrouping.create.mockResolvedValue(stored());
    mocks.studentGrouping.findUniqueOrThrow.mockResolvedValue(stored());
    mocks.studentGrouping.updateMany.mockResolvedValue({ count: 1 });
    mocks.studentGrouping.deleteMany.mockResolvedValue({ count: 1 });
    mocks.studentTeam.update.mockResolvedValue({ id: "team" });
    mocks.studentTeam.create.mockResolvedValue({ id: "new-team" });
  });

  it.each(["list", "create", "update", "delete"])("denies %s before reading or writing groupings", async (operation) => {
    mocks.authorize.mockRejectedValue({ status: 403 });
    const operations = {
      list: () => listStudentGroupings(user, "course", "section"),
      create: () => createStudentGrouping(user, "course", "section", input),
      update: () => updateStudentGrouping(user, "course", "section", "grouping", update),
      delete: () => deleteStudentGrouping(user, "course", "section", "grouping", { revision: 1 })
    };
    await expect(operations[operation as keyof typeof operations]()).rejects.toMatchObject({ status: 403 });
    expect(mocks.authorize).toHaveBeenCalledWith(user, "course", "section");
    expect(mocks.studentGrouping.findMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a section outside the requested course even for a course manager", async () => {
    mocks.courseGroup.findFirst.mockResolvedValue(null);
    await expect(listStudentGroupings(user, "wrong-course", "section")).rejects.toMatchObject({ status: 404 });
    expect(mocks.courseGroup.findFirst).toHaveBeenCalledWith({ where: { id: "section", courseId: "wrong-course" }, select: { id: true } });
    expect(mocks.studentGrouping.findMany).not.toHaveBeenCalled();
  });

  it("lists only students and groupings from the selected section", async () => {
    const result = await listStudentGroupings(user, "course", "section");
    expect(result.groupings[0]?.teams).toEqual([{ id: "team", title: "Team A", participantIds: ["student"] }]);
    expect(mocks.courseGroupParticipant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { groupId: "section", role: "student" } }));
    expect(mocks.studentGrouping.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { groupId: "section" } }));
  });

  it("creates teams and enrollment memberships atomically with actor-attributed audit", async () => {
    await createStudentGrouping(user, "course", "section", input);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.studentTeamMember.createMany).toHaveBeenCalledWith({ data: [{ groupingId: "grouping", teamId: "team", participantId: "student" }] });
    expect(mocks.courseAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: user.id, courseId: "course", eventType: "student_grouping_created", nextValue: expect.objectContaining({ groupId: "section" }) }) });
  });

  it.each([
    { teams: [{ title: "A", participantIds: ["student", "student"] }], code: "STUDENT_GROUPING_MEMBERS_DUPLICATE" },
    { teams: [{ title: "A", participantIds: ["student"] }, { title: "B", participantIds: ["student"] }], code: "STUDENT_GROUPING_MEMBERS_DUPLICATE" },
    { teams: [{ title: " A ", participantIds: [] }, { title: "a", participantIds: [] }], code: "STUDENT_GROUPING_TEAM_NAMES_DUPLICATE" },
    { teams: [{ id: "foreign-team", title: "A", participantIds: [] }], code: "STUDENT_GROUPING_TEAMS_INVALID" }
  ])("rejects invalid composition: $code", async ({ teams, code }) => {
    await expect(createStudentGrouping(user, "course", "section", { title: "Project", teams })).rejects.toMatchObject({ status: 400, code });
    expect(mocks.studentGrouping.create).not.toHaveBeenCalled();
  });

  it("rejects staff and students outside the section before creating a grouping", async () => {
    mocks.courseGroupParticipant.findMany.mockResolvedValue([]);
    await expect(createStudentGrouping(user, "course", "section", input)).rejects.toMatchObject({ code: "STUDENT_GROUPING_MEMBERS_INVALID" });
    expect(mocks.courseGroupParticipant.findMany).toHaveBeenCalledWith({ where: { id: { in: ["student"] }, role: "student", groupId: "section" }, select: { id: true } });
    expect(mocks.studentGrouping.create).not.toHaveBeenCalled();
  });

  it("preserves team identity on rename and replaces memberships under a revision check", async () => {
    mocks.studentGrouping.findUniqueOrThrow.mockResolvedValue({ ...stored(), revision: 2 });
    const result = await updateStudentGrouping(user, "course", "section", "grouping", update);
    expect(result.revision).toBe(2);
    expect(mocks.studentGrouping.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "grouping", groupId: "section", revision: 1 } }));
    expect(mocks.studentTeam.deleteMany).toHaveBeenCalledWith({ where: { groupingId: "grouping", id: { notIn: ["team"] } } });
    expect(mocks.studentTeam.update).toHaveBeenLastCalledWith({ where: { id: "team" }, data: { title: "Team A" } });
    expect(mocks.studentTeam.create).not.toHaveBeenCalled();
    expect(mocks.courseAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "student_grouping_updated", previousValue: expect.objectContaining({ revision: 1 }), nextValue: expect.objectContaining({ revision: 2 }) }) });
  });

  it("rejects a stale save before replacing teams", async () => {
    await expect(updateStudentGrouping(user, "course", "section", "grouping", { ...update, revision: 2 })).rejects.toMatchObject({ code: "STUDENT_GROUPING_CONFLICT", status: 409 });
    expect(mocks.studentTeamMember.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a concurrent edit after validation without deleting memberships", async () => {
    mocks.studentGrouping.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateStudentGrouping(user, "course", "section", "grouping", update)).rejects.toMatchObject({ status: 409 });
    expect(mocks.studentTeamMember.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["update", "delete"])("does not %s groupings from another section", async (operation) => {
    mocks.studentGrouping.findFirst.mockResolvedValue(null);
    await expect(operation === "update"
      ? updateStudentGrouping(user, "course", "section", "foreign", update)
      : deleteStudentGrouping(user, "course", "section", "foreign", { revision: 1 })
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.studentGrouping.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign", groupId: "section" } }));
  });

  it("rejects stale deletion without appending a successful audit", async () => {
    mocks.studentGrouping.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteStudentGrouping(user, "course", "section", "grouping", { revision: 1 })).rejects.toMatchObject({ status: 409 });
    expect(mocks.courseAuditEvent.create).not.toHaveBeenCalled();
  });

  it("deletes only the grouping and records its prior composition", async () => {
    await expect(deleteStudentGrouping(user, "course", "section", "grouping", { revision: 1 })).resolves.toEqual({ ok: true });
    expect(mocks.studentGrouping.deleteMany).toHaveBeenCalledWith({ where: { id: "grouping", groupId: "section", revision: 1 } });
    expect(mocks.courseAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: "student_grouping_deleted", previousValue: expect.objectContaining({ teams: [{ id: "team", title: "Team A", participantIds: ["student"] }] }) }) });
  });

  it.each(["P2002", "P2034", "P2003"])("translates database conflict %s to a recoverable response", async (code) => {
    mocks.transaction.mockRejectedValue(knownError(code));
    await expect(createStudentGrouping(user, "course", "section", input)).rejects.toMatchObject({ status: 409, code: code === "P2002" ? "STUDENT_GROUPING_TITLE_EXISTS" : "STUDENT_GROUPING_CONFLICT" });
  });
});
