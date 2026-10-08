import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  course: {
    update: vi.fn()
  },
  courseAuditEvent: {
    create: vi.fn()
  },
  courseGroupParticipant: {
    upsert: vi.fn()
  },
  courseMembership: {
    count: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(async (handler: (transaction: typeof tx) => unknown) => handler(tx)),
  aiAgentConnection: {
    findFirst: vi.fn()
  },
  courseGroup: {
    findFirst: vi.fn()
  },
  course: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  courseMembership: {
    create: vi.fn(),
    upsert: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {},
    TransactionIsolationLevel: { Serializable: "Serializable" }
  }
}));

vi.mock("./authorization", () => ({
  assertCanCreateCourse: vi.fn(),
  assertCanManageCourse: vi.fn(),
  assertCanManageCourseStaff: vi.fn(),
  assertCanViewCourse: vi.fn(),
  getCourseCapabilities: vi.fn().mockResolvedValue({
    canViewCourse: true,
    canManageCourse: true,
    canManageCourseStaff: true,
    canViewGradebook: true,
    canGrade: true,
    canReleaseGrades: true,
    canExportGrades: true,
    canViewChallenges: true,
    canRespondChallenges: true,
    gradingGroupIds: null,
    sectionRoles: []
  }),
  isAdmin: (user: { roles: string[] }) => user.roles.includes("admin"),
  isCourseManager: (user: { roles: string[] }) => user.roles.includes("course_manager") || user.roles.includes("admin"),
  isTeacher: (user: { roles: string[] }) => user.roles.includes("teacher") || user.roles.includes("admin")
}));

const {
  addCourseMembership,
  archiveCourse,
  createCourse,
  getCourse,
  listCourses,
  removeCourseMembership,
  updateCourse,
  updateCourseSettings
} = await import("./courses");

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
    mockPrisma.$transaction.mockImplementation(async (handler: (transaction: typeof tx) => unknown) => handler(tx));
    mockPrisma.course.findMany.mockResolvedValue([]);
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

  it("separates explicit course staff, section staff, and learner course-list scopes", async () => {
    await listCourses(teacherUser);

    expect(mockPrisma.course.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          memberships: {
            some: {
              userId: "teacher-1",
              source: "explicit",
              role: { in: ["owner", "teacher"] }
            }
          }
        }
      })
    );
    expect(mockPrisma.course.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          groups: {
            some: {
              participants: {
                some: { userId: "teacher-1", role: { in: ["teacher", "ta"] } }
              }
            }
          }
        },
        include: expect.objectContaining({
          memberships: expect.objectContaining({ where: { userId: "teacher-1" } }),
          groups: expect.objectContaining({
            where: { participants: { some: { userId: "teacher-1", role: { in: ["teacher", "ta"] } } } }
          })
        })
      })
    );
    expect(mockPrisma.course.findMany).toHaveBeenCalledTimes(3);
  });

  it("lists all courses for admins and only enrolled visible groups for students", async () => {
    mockPrisma.course.findMany.mockResolvedValueOnce([]);

    await listCourses({ ...teacherUser, roles: ["admin"] });
    expect(mockPrisma.course.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));

    await listCourses({ ...teacherUser, id: "student-1", roles: ["student"] });
    expect(mockPrisma.course.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          memberships: { some: { userId: "student-1", role: "student" } },
          groups: {
            some: expect.objectContaining({
              participants: { some: { userId: "student-1" } },
              status: "published"
            })
          }
        },
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
    await expect(getCourse(teacherUser, "course-1")).resolves.toMatchObject({
      id: "course-1",
      permissions: { canManageCourse: true }
    });

    tx.course.update.mockResolvedValue({ id: "course-1", title: "Updated" });
    await expect(updateCourse(teacherUser, "course-1", { title: "Updated" })).resolves.toEqual({
      id: "course-1",
      title: "Updated"
    });

    await archiveCourse(teacherUser, "course-1");
    expect(tx.course.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "course-1" },
        data: { status: "archived" }
      })
    );
  });

  it("stores the student content layout in course metadata without replacing other settings", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ metadata: { theme: "quiet", aiSettings: { previous: true } } });
    tx.course.update.mockResolvedValue({ id: "course-1" });

    await updateCourse(teacherUser, "course-1", {
      title: "Updated course",
      studentContentLayout: "folder_tabs"
    });

    expect(tx.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "course-1" },
        data: {
          title: "Updated course",
          metadata: {
            theme: "quiet",
            aiSettings: { previous: true },
            studentContentLayout: "folder_tabs"
          }
        }
      })
    );
  });

  it("adds non-student course memberships with the selected enrollment role", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "teacher-2",
      roles: [{ role: { key: "teacher" } }]
    });
    tx.courseMembership.findUnique.mockResolvedValue(null);
    tx.courseMembership.upsert.mockResolvedValue({
      id: "membership-1",
      userId: "teacher-2",
      role: "teacher",
      source: "explicit"
    });

    await addCourseMembership(teacherUser, "course-1", {
      userId: "teacher-2",
      role: "teacher"
    });

    expect(tx.courseMembership.upsert).toHaveBeenCalledWith({
      where: { courseId_userId_role: { courseId: "course-1", userId: "teacher-2", role: "teacher" } },
      update: { source: "explicit" },
      create: { courseId: "course-1", userId: "teacher-2", role: "teacher", source: "explicit" },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
  });

  it("blocks removal of the final explicit owner inside a serializable transaction", async () => {
    tx.courseMembership.findFirst.mockResolvedValue({
      id: "membership-owner",
      userId: "teacher-1",
      role: "owner",
      source: "explicit"
    });
    tx.courseMembership.count.mockResolvedValue(1);

    await expect(removeCourseMembership(teacherUser, "course-1", "membership-owner"))
      .rejects.toMatchObject({ code: "LAST_COURSE_OWNER_REQUIRED", status: 409 });

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
    expect(tx.courseMembership.delete).not.toHaveBeenCalled();
  });

  it("removes and audits an explicit owner when another owner remains", async () => {
    tx.courseMembership.findFirst.mockResolvedValue({
      id: "membership-owner",
      userId: "teacher-2",
      role: "owner",
      source: "explicit"
    });
    tx.courseMembership.count.mockResolvedValue(2);

    await expect(removeCourseMembership(teacherUser, "course-1", "membership-owner"))
      .resolves.toEqual({ ok: true });

    expect(tx.courseAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "teacher-1",
        courseId: "course-1",
        eventType: "course_membership_removed",
        targetId: "membership-owner"
      })
    });
    expect(tx.courseMembership.delete).toHaveBeenCalledWith({ where: { id: "membership-owner" } });
  });

  it("requires student enrollments to be attached to a course group", async () => {
    await expect(
      addCourseMembership(teacherUser, "course-1", {
        userId: "student-1",
        role: "student"
      })
    ).rejects.toMatchObject({
      status: 400,
      code: "STUDENT_GROUP_REQUIRED"
    });

    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1" });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "student-1",
      email: "Student@Example.test",
      name: "Student One",
      firstName: "Student",
      lastName: "One"
    });
    tx.courseMembership.upsert.mockResolvedValue({ id: "membership-1" });

    await addCourseMembership(teacherUser, "course-1", {
      userId: "student-1",
      role: "student",
      groupId: "group-1"
    });

    expect(tx.courseMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId_userId_role: { courseId: "course-1", userId: "student-1", role: "student" } }
      })
    );
    expect(tx.courseGroupParticipant.upsert).toHaveBeenCalledWith({
      where: { groupId_email: { groupId: "group-1", email: "student@example.test" } },
      update: { userId: "student-1", role: "student" },
      create: {
        groupId: "group-1",
        userId: "student-1",
        role: "student",
        firstName: "Student",
        lastName: "One",
        email: "student@example.test"
      }
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
    tx.course.update.mockResolvedValue({ id: "course-1" });

    await updateCourseSettings(teacherUser, "course-1", {
      studentSupportAiAgentConnectionId: agentId
    });

    expect(tx.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "course-1" },
        data: {
          metadata: {
            theme: "quiet",
            aiSettings: {
              previous: true,
              studentSupportAiAgentConnectionId: agentId,
              automaticFeedbackEnabled: false,
              assessmentFeedbackAiAgentConnectionId: null
            }
          }
        }
      })
    );
  });

  it("clears course AI settings and rejects inaccessible agent connections", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({ metadata: { aiSettings: { previous: true } } });
    tx.course.update.mockResolvedValue({ id: "course-1" });

    await updateCourseSettings(teacherUser, "course-1", {
      studentSupportAiAgentConnectionId: null
    });

    expect(tx.course.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          metadata: {
            aiSettings: {
              previous: true,
              studentSupportAiAgentConnectionId: null,
              automaticFeedbackEnabled: false,
              assessmentFeedbackAiAgentConnectionId: null
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

  it("requires and persists a dedicated model when automatic assessment feedback is enabled", async () => {
    const agentId = "seed-ai-agent-student-support";
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({ id: agentId, provider: "openai", apiKey: "secret" });
    mockPrisma.course.findUnique.mockResolvedValue({ metadata: {} });
    tx.course.update.mockResolvedValue({ id: "course-1" });

    await expect(updateCourseSettings(teacherUser, "course-1", {
      automaticFeedbackEnabled: true,
      assessmentFeedbackAiAgentConnectionId: null
    })).rejects.toMatchObject({ name: "ZodError" });

    await updateCourseSettings(teacherUser, "course-1", {
      automaticFeedbackEnabled: true,
      assessmentFeedbackAiAgentConnectionId: agentId,
      studentSupportAiAgentConnectionId: null
    });
    expect(tx.course.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        metadata: {
          aiSettings: {
            automaticFeedbackEnabled: true,
            assessmentFeedbackAiAgentConnectionId: agentId,
            studentSupportAiAgentConnectionId: null
          }
        }
      }
    }));

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({ id: agentId, provider: "openai", apiKey: null });
    await expect(updateCourseSettings(teacherUser, "course-1", {
      automaticFeedbackEnabled: true,
      assessmentFeedbackAiAgentConnectionId: agentId
    })).rejects.toMatchObject({ code: "AI_AGENT_KEY_MISSING" });
  });
});
