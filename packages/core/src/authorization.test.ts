import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  courseGroupParticipant: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  courseMembership: {
    findMany: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

const { assertCanCreateCourse, assertCanManageCourse, assertCanPreviewGroupAsStudent, assertCanViewCourse, canManageCourse, getCourseCapabilities } = await import("./authorization");

const user = (roles: CurrentUser["roles"], id = "user-1"): CurrentUser => ({
  id,
  email: `${id}@example.test`,
  name: null,
  firstName: null,
  lastName: null,
  roles
});

describe("authorization helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue(null);
    mockPrisma.courseGroupParticipant.findMany.mockResolvedValue([]);
    mockPrisma.courseMembership.findMany.mockResolvedValue([]);
  });

  it("lets admins manage and view any course without a membership lookup", async () => {
    const admin = user(["admin"]);

    await expect(canManageCourse(admin, "course-1")).resolves.toBe(true);
    await expect(assertCanManageCourse(admin, "course-1")).resolves.toBeUndefined();
    await expect(assertCanViewCourse(admin, "course-1")).resolves.toBeUndefined();

    expect(mockPrisma.courseMembership.findMany).not.toHaveBeenCalled();
  });

  it("allows course creation only to course managers and admins", async () => {
    await expect(assertCanCreateCourse(user(["course_manager"]))).resolves.toBeUndefined();
    await expect(assertCanCreateCourse(user(["admin"]))).resolves.toBeUndefined();
    await expect(assertCanCreateCourse(user(["teacher"]))).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("allows only explicit owner and teacher memberships to manage a course", async () => {
    for (const role of ["owner", "teacher"] as const) {
      mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role, source: "explicit" }]);
      await expect(canManageCourse(user(["teacher"]), "course-1")).resolves.toBe(true);
    }
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "ta", source: "explicit" }]);
    await expect(canManageCourse(user(["teacher"]), "course-1")).resolves.toBe(false);
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "teacher", source: "section_derived" }]);
    await expect(canManageCourse(user(["teacher"]), "course-1")).resolves.toBe(false);
  });

  it("does not let student-only memberships manage a course", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValue([{ role: "student", source: "explicit" }]);

    await expect(canManageCourse(user(["student"]), "course-1")).resolves.toBe(false);
    await expect(assertCanManageCourse(user(["student"]), "course-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("requires student course viewers to participate in at least one group", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "student", source: "explicit" }]);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce({ id: "participant-1" });
    await expect(assertCanViewCourse(user(["student"]), "course-1")).resolves.toBeUndefined();

    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([]);
    await expect(assertCanViewCourse(user(["student"], "outsider"), "course-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });

    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "student", source: "explicit" }]);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce(null);
    await expect(assertCanViewCourse(user(["student"]), "course-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("does not treat a stale derived membership as course access", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "teacher", source: "section_derived" }]);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce(null);

    await expect(assertCanViewCourse(user(["teacher"]), "course-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("allows course managers and the assigned section teacher to use Student view, but not TAs or students", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "teacher", source: "explicit" }]);
    await expect(assertCanPreviewGroupAsStudent(user(["teacher"]), "course-1", "group-1")).resolves.toBeUndefined();

    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([]);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce({ id: "section-teacher" });
    await expect(assertCanPreviewGroupAsStudent(user(["teacher"]), "course-1", "group-1")).resolves.toBeUndefined();
    expect(mockPrisma.courseGroupParticipant.findFirst).toHaveBeenLastCalledWith({
      where: { userId: "user-1", groupId: "group-1", role: "teacher", group: { courseId: "course-1" } },
      select: { id: true }
    });

    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([]);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce(null);
    await expect(assertCanPreviewGroupAsStudent(user(["teacher"]), "course-1", "group-1")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("reports learner visibility without granting gradebook capabilities", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "student", source: "explicit" }]);
    mockPrisma.courseGroupParticipant.findMany.mockResolvedValueOnce([{ groupId: "group-1", role: "student" }]);

    await expect(getCourseCapabilities(user(["student"]), "course-1")).resolves.toMatchObject({
      canViewCourse: true,
      canManageCourse: false,
      canViewGradebook: false,
      gradingGroupIds: []
    });
  });
});
