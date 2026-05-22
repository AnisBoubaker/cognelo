import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const mockPrisma = vi.hoisted(() => ({
  courseGroupParticipant: {
    findFirst: vi.fn()
  },
  courseMembership: {
    findMany: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma
}));

const { assertCanCreateCourse, assertCanManageCourse, assertCanViewCourse, canManageCourse } = await import("./authorization");

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

  it("allows owner, teacher, and TA memberships to manage a course", async () => {
    for (const role of ["owner", "teacher", "ta"] as const) {
      mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role }]);
      await expect(canManageCourse(user(["teacher"]), "course-1")).resolves.toBe(true);
    }
  });

  it("does not let student-only memberships manage a course", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValue([{ role: "student" }]);

    await expect(canManageCourse(user(["student"]), "course-1")).resolves.toBe(false);
    await expect(assertCanManageCourse(user(["student"]), "course-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("requires student course viewers to participate in at least one group", async () => {
    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([{ role: "student" }]);
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValueOnce({ id: "participant-1" });
    await expect(assertCanViewCourse(user(["student"]), "course-1")).resolves.toBeUndefined();

    mockPrisma.courseMembership.findMany.mockResolvedValueOnce([]);
    await expect(assertCanViewCourse(user(["student"], "outsider"), "course-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });
});
