import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  courseGroupParticipant: {
    create: vi.fn()
  },
  courseMembership: {
    upsert: vi.fn()
  },
  role: {
    findUnique: vi.fn()
  },
  userRole: {
    upsert: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  activity: {
    findFirst: vi.fn()
  },
  courseGroup: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  courseGroupActivity: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  courseGroupHiddenCourseMaterial: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn()
  },
  courseGroupMaterial: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  courseGroupParticipant: {
    delete: vi.fn(),
    findFirst: vi.fn()
  },
  courseMaterial: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  }
}));

const authMocks = vi.hoisted(() => ({
  assertCanManageCourse: vi.fn(),
  assertCanViewCourse: vi.fn(),
  canManageCourse: vi.fn(),
  isAdmin: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {}
  }
}));

vi.mock("./authorization", () => authMocks);

const {
  addGroupParticipant,
  assignActivityToGroup,
  createCourseGroup,
  createGroupMaterial,
  getCourseMaterialForGroupDownload,
  getGroupAssignedActivity,
  hideCourseMaterialForGroup,
  listCourseGroups
} = await import("./groups");

const teacherUser: CurrentUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: "Ada Teacher",
  firstName: "Ada",
  lastName: "Teacher",
  roles: ["teacher"]
};

const studentUser: CurrentUser = {
  id: "student-1",
  email: "student@example.test",
  name: "Student One",
  firstName: "Student",
  lastName: "One",
  roles: ["student"]
};

describe("group services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    authMocks.canManageCourse.mockResolvedValue(true);
    authMocks.isAdmin.mockReturnValue(false);
  });

  it("creates groups as drafts with the creator as a teacher participant", async () => {
    mockPrisma.courseGroup.create.mockResolvedValue({ id: "group-1" });

    await expect(createCourseGroup(teacherUser, "course-1", { title: "Team A" })).resolves.toEqual({ id: "group-1" });

    expect(mockPrisma.courseGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Team A",
        status: "draft",
        courseId: "course-1",
        createdById: "teacher-1",
        participants: {
          create: expect.objectContaining({
            userId: "teacher-1",
            role: "teacher",
            firstName: "Ada",
            lastName: "Teacher",
            email: "teacher@example.test"
          })
        }
      })
    });
  });

  it("filters non-manager group lists to published groups where the user participates", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findMany.mockResolvedValue([]);

    await listCourseGroups(studentUser, "course-1");

    expect(mockPrisma.courseGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId: "course-1",
          status: "published",
          participants: { some: { userId: "student-1" } }
        })
      })
    );
  });

  it("adds an existing student participant and ensures student role and course membership", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "student-1", email: "student@example.test", name: "Student One" });
    tx.courseGroupParticipant.create.mockResolvedValue({ id: "participant-1" });
    tx.role.findUnique.mockResolvedValue({ id: "role-student", key: "student" });

    await addGroupParticipant(teacherUser, "course-1", "group-1", {
      email: "Student@Example.Test",
      role: "student"
    });

    expect(tx.courseGroupParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: "group-1",
          userId: "student-1",
          role: "student",
          firstName: "Student",
          lastName: "One",
          email: "student@example.test"
        })
      })
    );
    expect(tx.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_roleId: { userId: "student-1", roleId: "role-student" } }
      })
    );
    expect(tx.courseMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId_userId_role: { courseId: "course-1", userId: "student-1", role: "student" } }
      })
    );
  });

  it("rejects unavailable assigned activities for students", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findFirst.mockResolvedValue({
      id: "group-1",
      courseId: "course-1",
      status: "published",
      availableFrom: null,
      availableUntil: null
    });
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1", userId: "student-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      activityId: "activity-1",
      availableFrom: new Date(Date.now() + 60_000),
      availableUntil: null,
      activity: { id: "activity-1" }
    });

    await expect(getGroupAssignedActivity(studentUser, "course-1", "group-1", "activity-1")).rejects.toMatchObject({
      status: 403,
      code: "GROUP_ACTIVITY_NOT_AVAILABLE"
    });
  });

  it("rejects duplicate group activity assignments", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue({ id: "activity-1", courseId: "course-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({ id: "assignment-1" });

    await expect(
      assignActivityToGroup(teacherUser, "course-1", "group-1", {
        activityId: "activity-1"
      })
    ).rejects.toMatchObject({ status: 400, code: "GROUP_ACTIVITY_EXISTS" });

    expect(mockPrisma.courseGroupActivity.create).not.toHaveBeenCalled();
  });

  it("creates group material only when the parent is an existing folder in the group", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseGroupMaterial.findFirst.mockResolvedValueOnce({ id: "folder-1", groupId: "group-1", kind: "folder" });
    mockPrisma.courseGroupMaterial.create.mockResolvedValue({ id: "material-1" });

    await createGroupMaterial(teacherUser, "course-1", "group-1", {
      title: "Notes",
      kind: "file",
      parentId: "folder-1",
      fileName: "notes.pdf",
      mimeType: "application/pdf",
      sizeBytes: 123,
      storagePath: "course-1/groups/group-1/notes.pdf"
    });

    expect(mockPrisma.courseGroupMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: "group-1",
          parentId: "folder-1",
          createdById: "teacher-1"
        })
      })
    );
  });

  it("hides course materials for a group with a scoped upsert", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseMaterial.findFirst.mockResolvedValue({ id: "material-1", courseId: "course-1" });

    await expect(hideCourseMaterialForGroup(teacherUser, "course-1", "group-1", "material-1")).resolves.toEqual({ ok: true });

    expect(mockPrisma.courseGroupHiddenCourseMaterial.upsert).toHaveBeenCalledWith({
      where: {
        groupId_courseMaterialId: {
          groupId: "group-1",
          courseMaterialId: "material-1"
        }
      },
      update: {},
      create: {
        groupId: "group-1",
        courseMaterialId: "material-1"
      }
    });
  });

  it("blocks student downloads of course materials hidden through a parent folder", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findFirst.mockResolvedValue({
      id: "group-1",
      courseId: "course-1",
      status: "published",
      availableFrom: null,
      availableUntil: null
    });
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1", userId: "student-1" });
    mockPrisma.courseMaterial.findFirst
      .mockResolvedValueOnce({ id: "material-1", courseId: "course-1" })
      .mockResolvedValueOnce({ id: "material-1", courseId: "course-1", kind: "file", parentId: "folder-1" });
    mockPrisma.courseGroupHiddenCourseMaterial.findMany.mockResolvedValue([{ courseMaterialId: "folder-1" }]);
    mockPrisma.courseMaterial.findMany.mockResolvedValue([
      { id: "folder-1", parentId: null },
      { id: "material-1", parentId: "folder-1" }
    ]);

    await expect(getCourseMaterialForGroupDownload(studentUser, "course-1", "group-1", "material-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });
});
