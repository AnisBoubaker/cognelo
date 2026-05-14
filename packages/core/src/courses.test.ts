import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  aiAgentConnection: {
    findFirst: vi.fn()
  },
  course: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  courseMembership: {
    create: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

vi.mock("./authorization", () => ({
  assertCanCreateCourse: vi.fn(),
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn(),
  isAdmin: (user: { roles: string[] }) => user.roles.includes("admin"),
  isCourseManager: (user: { roles: string[] }) => user.roles.includes("course_manager") || user.roles.includes("admin"),
  isTeacher: (user: { roles: string[] }) => user.roles.includes("teacher") || user.roles.includes("admin")
}));

const { addCourseMembership, archiveCourse, createCourse, getCourse, listCourses, updateCourse, updateCourseSettings } = await import("./courses");

const teacherUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};

describe("course services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a course with an owner membership for the creator", async () => {
    mockPrisma.course.create.mockResolvedValue({ id: "course-1" });

    await expect(
      createCourse(teacherUser, {
        subjectId: "subject-1",
        title: "Programming 101"
      })
    ).resolves.toEqual({ id: "course-1" });

    expect(mockPrisma.course.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId: "subject-1",
          title: "Programming 101",
          status: "draft",
          createdById: "teacher-1",
          memberships: {
            create: {
              userId: "teacher-1",
              role: "owner"
            }
          }
        })
      })
    );
  });

  it("limits teacher course lists to created or member courses", async () => {
    mockPrisma.course.findMany.mockResolvedValue([]);

    await listCourses(teacherUser);

    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ createdById: "teacher-1" }, { memberships: { some: { userId: "teacher-1" } } }]
        }
      })
    );
  });

  it("lists all courses for admins and only enrolled visible groups for students", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([]);

    await listCourses({ ...teacherUser, roles: ["admin"] });
    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));

    mockPrisma.course.findMany.mockResolvedValueOnce([]);
    await listCourses({ ...teacherUser, id: "student-1", roles: ["student"] });
    expect(mockPrisma.course.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { memberships: { some: { userId: "student-1" } } },
        include: expect.objectContaining({
          groups: expect.objectContaining({
            where: expect.objectContaining({
              participants: { some: { userId: "student-1" } },
              status: "published"
            })
          })
        })
      })
    );
  });

  it("gets, updates, and archives courses through authorization helpers", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ id: "course-1" });
    await expect(getCourse(teacherUser, "course-1")).resolves.toEqual({ id: "course-1" });

    mockPrisma.course.update.mockResolvedValue({ id: "course-1", title: "Updated" });
    await expect(updateCourse(teacherUser, "course-1", { title: "Updated" })).resolves.toEqual({
      id: "course-1",
      title: "Updated"
    });

    await archiveCourse(teacherUser, "course-1");
    expect(mockPrisma.course.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "course-1" },
        data: { status: "archived" }
      })
    );
  });

  it("adds course memberships with the selected enrollment role", async () => {
    mockPrisma.courseMembership.create.mockResolvedValue({ id: "membership-1" });

    await addCourseMembership(teacherUser, "course-1", {
      userId: "student-1",
      role: "student"
    });

    expect(mockPrisma.courseMembership.create).toHaveBeenCalledWith({
      data: {
        courseId: "course-1",
        userId: "student-1",
        role: "student"
      },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
  });

  it("merges course AI settings into existing metadata", async () => {
    const agentId = "clx0000000000000000000000";
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({ id: agentId });
    mockPrisma.course.findUnique.mockResolvedValue({
      metadata: {
        theme: "quiet",
        aiSettings: { previous: true }
      }
    });
    mockPrisma.course.update.mockResolvedValue({ id: "course-1" });

    await updateCourseSettings(teacherUser, "course-1", {
      studentSupportAiAgentConnectionId: agentId
    });

    expect(mockPrisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "course-1" },
        data: {
          metadata: {
            theme: "quiet",
            aiSettings: {
              previous: true,
              studentSupportAiAgentConnectionId: agentId
            }
          }
        }
      })
    );
  });

  it("clears course AI settings and rejects inaccessible agent connections", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ metadata: { aiSettings: { previous: true } } });
    mockPrisma.course.update.mockResolvedValue({ id: "course-1" });

    await updateCourseSettings(teacherUser, "course-1", {
      studentSupportAiAgentConnectionId: null
    });

    expect(mockPrisma.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          metadata: {
            aiSettings: {
              previous: true,
              studentSupportAiAgentConnectionId: null
            }
          }
        }
      })
    );

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue(null);
    await expect(
      updateCourseSettings(teacherUser, "course-1", {
        studentSupportAiAgentConnectionId: "clx0000000000000000000000"
      })
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
