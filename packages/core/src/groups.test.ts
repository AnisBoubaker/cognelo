import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";

const tx = vi.hoisted(() => ({
  activity: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  courseGroup: {
    create: vi.fn(),
    findMany: vi.fn()
  },
  courseGroupActivity: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  },
  courseContentItem: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  gradebookItem: {
    upsert: vi.fn()
  },
  courseGroupParticipant: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn()
  },
  courseMembership: {
    deleteMany: vi.fn(),
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
    findFirst: vi.fn(),
    update: vi.fn()
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
    createMany: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn()
  },
  courseContentItem: {
    findMany: vi.fn()
  },
  courseGroupContentVisibilityOverride: {
    findMany: vi.fn()
  },
  courseGroupHiddenCourseMaterial: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn()
  },
  gradebookItem: {
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
  },
  test: {
    findFirst: vi.fn()
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
  assignActivityToAllCourseGroups,
  assignActivityToGroup,
  createCourseGroup,
  createGroupMaterial,
  getCourseGroup,
  getCourseMaterialForGroupDownload,
  getGroupAssignedActivity,
  hideCourseMaterialForGroup,
  listCourseGroups,
  removeActivityFromAllCourseGroupsPolicy,
  updateGroupActivityAssignment
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
    tx.courseGroupActivity.create.mockImplementation(async (input: { data: { groupId: string; activityId: string } }) => ({
      id: "assignment-created",
      groupId: input.data.groupId,
      activityId: input.data.activityId,
      activity: { id: input.data.activityId }
    }));
    tx.courseGroupActivity.upsert.mockImplementation(
      async (input: { where: { groupId_activityId: { groupId: string; activityId: string } } }) => ({
        id: `assignment-${input.where.groupId_activityId.groupId}`,
        groupId: input.where.groupId_activityId.groupId,
        activityId: input.where.groupId_activityId.activityId
      })
    );
    tx.courseContentItem.count.mockResolvedValue(0);
    tx.courseContentItem.findFirst.mockResolvedValue(null);
    mockPrisma.courseGroupContentVisibilityOverride.findMany.mockResolvedValue([]);
    tx.gradebookItem.upsert.mockResolvedValue({ id: "gradebook-item-1" });
    authMocks.canManageCourse.mockResolvedValue(true);
    authMocks.isAdmin.mockReturnValue(false);
    mockPrisma.test.findFirst.mockResolvedValue({
      items: [{ activity: { title: "Knowledge check", activityType: { key: "mcq" } } }]
    });
  });

  it("creates groups as drafts with the creator as a teacher participant", async () => {
    tx.courseGroup.create.mockResolvedValue({ id: "group-1" });
    tx.activity.findMany.mockResolvedValue([]);

    await expect(createCourseGroup(teacherUser, "course-1", { title: "Team A" })).resolves.toEqual({ id: "group-1" });

    expect(tx.courseGroup.create).toHaveBeenCalledWith({
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

  it("creates gradebook items for course-wide assignments inherited by a new group", async () => {
    tx.courseGroup.create.mockResolvedValue({ id: "group-1" });
    tx.activity.findMany.mockResolvedValue([
      {
        id: "activity-1",
        title: "Parsons warmup",
        metadata: {
          allGroupsAssignment: {
            enabled: true,
            availableFrom: "2026-05-18T13:00:00.000Z",
            availableUntil: null,
            enablePerGroupSettings: true
          }
        }
      }
    ]);

    await createCourseGroup(teacherUser, "course-1", { title: "Team A" });

    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledWith({
      where: {
        groupId_activityId: {
          groupId: "group-1",
          activityId: "activity-1"
        }
      },
      update: {},
      create: {
        groupId: "group-1",
        activityId: "activity-1",
        availableFrom: new Date("2026-05-18T13:00:00.000Z"),
        availableUntil: null,
        metadata: { assignmentScope: "course_all_groups", enablePerGroupSettings: true, assessmentMode: "formative" },
        position: 0
      }
    });
    expect(tx.gradebookItem.upsert).toHaveBeenCalledWith({
      where: { groupActivityId: "assignment-group-1" },
      update: {},
      create: {
        courseId: "course-1",
        groupId: "group-1",
        groupActivityId: "assignment-group-1",
        activityId: "activity-1",
        titleSnapshot: "Parsons warmup"
      }
    });
  });

  it("assigns a course activity to all current groups and stores the future-group rule", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "activity-1",
      courseId: "course-1",
      title: "Loop practice",
      metadata: { researchTags: [] }
    });
    tx.courseGroup.findMany.mockResolvedValue([
      { id: "group-1", activities: [] },
      { id: "group-2", activities: [{ id: "assignment-2", activityId: "activity-1", position: 3 }] }
    ]);
    tx.activity.update.mockResolvedValue({ id: "activity-1" });
    tx.activity.findFirst = vi.fn().mockResolvedValue({ id: "activity-1" });

    await expect(
      assignActivityToAllCourseGroups(teacherUser, "course-1", "activity-1", {
        availableFrom: "2026-05-18T13:00:00.000Z",
        availableUntil: "2026-05-25T13:00:00.000Z"
      })
    ).resolves.toEqual({ id: "activity-1" });

    expect(tx.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "activity-1" },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            allGroupsAssignment: {
              enabled: true,
              availableFrom: "2026-05-18T13:00:00.000Z",
              availableUntil: "2026-05-25T13:00:00.000Z",
              enablePerGroupSettings: true,
              assessmentMode: "formative"
            }
          })
        })
      })
    );
    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledTimes(2);
    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_activityId: { groupId: "group-1", activityId: "activity-1" } },
        create: expect.objectContaining({
          groupId: "group-1",
          activityId: "activity-1",
          availableFrom: new Date("2026-05-18T13:00:00.000Z"),
          availableUntil: new Date("2026-05-25T13:00:00.000Z"),
          metadata: { assignmentScope: "course_all_groups", enablePerGroupSettings: true, assessmentMode: "formative" }
        })
      })
    );
    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_activityId: { groupId: "group-2", activityId: "activity-1" } },
        update: {
          metadata: { assignmentScope: "course_all_groups", enablePerGroupSettings: true, assessmentMode: "formative" }
        }
      })
    );
    expect(tx.gradebookItem.upsert).toHaveBeenCalledWith({
      where: { groupActivityId: "assignment-group-1" },
      update: {},
      create: {
        courseId: "course-1",
        groupId: "group-1",
        groupActivityId: "assignment-group-1",
        activityId: "activity-1",
        titleSnapshot: "Loop practice"
      }
    });
    expect(tx.gradebookItem.upsert).toHaveBeenCalledWith({
      where: { groupActivityId: "assignment-group-2" },
      update: {},
      create: {
        courseId: "course-1",
        groupId: "group-2",
        groupActivityId: "assignment-group-2",
        activityId: "activity-1",
        titleSnapshot: "Loop practice"
      }
    });
  });

  it("assigns a Test summatively to all groups with one gradebook item per assignment", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "test-activity-1",
      courseId: "course-1",
      title: "Final test",
      metadata: {},
      activityType: { key: "test" }
    });
    tx.courseGroup.findMany.mockResolvedValue([
      { id: "group-1", activities: [] },
      { id: "group-2", activities: [] }
    ]);
    tx.activity.update.mockResolvedValue({ id: "test-activity-1" });
    tx.activity.findFirst = vi.fn().mockResolvedValue({ id: "test-activity-1" });

    await assignActivityToAllCourseGroups(teacherUser, "course-1", "test-activity-1", {
      assessmentMode: "summative",
      gradebookSettings: { pointsPossible: 60 },
      contentPlacement: { isVisible: true }
    });

    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledTimes(2);
    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        activityId: "test-activity-1",
        metadata: expect.objectContaining({ assessmentMode: "summative" })
      })
    }));
    expect(tx.gradebookItem.upsert).toHaveBeenCalledTimes(2);
    expect(tx.courseContentItem.create).toHaveBeenCalledTimes(2);
    expect(tx.activity.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          allGroupsAssignment: expect.objectContaining({ assessmentMode: "summative" })
        })
      })
    }));
  });

  it("rejects assigning a Test formatively to all groups", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "test-activity-1",
      courseId: "course-1",
      activityType: { key: "test" }
    });

    await expect(
      assignActivityToAllCourseGroups(teacherUser, "course-1", "test-activity-1", {
        assessmentMode: "formative"
      })
    ).rejects.toMatchObject({ status: 400, code: "TEST_SUMMATIVE_ONLY" });

    expect(tx.courseGroupActivity.upsert).not.toHaveBeenCalled();
    expect(tx.gradebookItem.upsert).not.toHaveBeenCalled();
  });

  it("rejects assigning a Test whose child plugin has not opted into composite execution", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "test-activity-1",
      courseId: "course-1",
      activityType: { key: "test" }
    });
    mockPrisma.test.findFirst.mockResolvedValue({
      items: [{ activity: { title: "Unsupported activity", activityType: { key: "placeholder" } } }]
    });

    await expect(
      assignActivityToAllCourseGroups(teacherUser, "course-1", "test-activity-1", {
        assessmentMode: "summative"
      })
    ).rejects.toMatchObject({ status: 409, code: "TEST_ITEM_COMPOSITE_UNSUPPORTED" });

    expect(tx.courseGroupActivity.upsert).not.toHaveBeenCalled();
  });

  it("applies course-wide dates to existing group assignments when per-group settings are disabled", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "activity-1",
      courseId: "course-1",
      metadata: {}
    });
    tx.courseGroup.findMany.mockResolvedValue([
      { id: "group-1", activities: [{ id: "assignment-1", activityId: "activity-1", position: 0 }] }
    ]);
    tx.activity.update.mockResolvedValue({ id: "activity-1" });
    tx.activity.findFirst.mockResolvedValue({ id: "activity-1" });

    await assignActivityToAllCourseGroups(teacherUser, "course-1", "activity-1", {
      availableFrom: "2026-05-18T13:00:00.000Z",
      availableUntil: "2026-05-25T13:00:00.000Z",
      enablePerGroupSettings: false
    });

    expect(tx.courseGroupActivity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_activityId: { groupId: "group-1", activityId: "activity-1" } },
        update: {
          availableFrom: new Date("2026-05-18T13:00:00.000Z"),
          availableUntil: new Date("2026-05-25T13:00:00.000Z"),
          metadata: { assignmentScope: "course_all_groups", enablePerGroupSettings: false, assessmentMode: "formative" }
        }
      })
    );
  });

  it("materializes root content items for course-wide all-groups placement", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "activity-1",
      courseId: "course-1",
      title: "Loop practice",
      metadata: {}
    });
    tx.courseGroup.findMany.mockResolvedValue([{ id: "group-1", activities: [] }]);
    tx.activity.update.mockResolvedValue({ id: "activity-1" });
    tx.activity.findFirst.mockResolvedValue({ id: "activity-1" });

    await assignActivityToAllCourseGroups(teacherUser, "course-1", "activity-1", {
      contentPlacement: {
        titleSnapshot: "Week activity",
        isVisible: false
      }
    });

    expect(tx.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          metadata: {
            allGroupsAssignment: expect.objectContaining({
              contentPlacement: expect.objectContaining({
                titleSnapshot: "Week activity",
                isVisible: false
              })
            })
          }
        }
      })
    );
    expect(tx.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        parentId: null,
        kind: "activity",
        titleSnapshot: "Week activity",
        isVisible: false,
        activityId: "activity-1",
        courseGroupActivityId: "assignment-group-1"
      })
    });
  });

  it("creates course-wide content placement when a future group inherits assignments", async () => {
    tx.courseGroup.create.mockResolvedValue({ id: "group-1" });
    tx.activity.findMany.mockResolvedValue([
      {
        id: "activity-1",
        title: "Parsons warmup",
        metadata: {
          allGroupsAssignment: {
            enabled: true,
            assessmentMode: "formative",
            contentPlacement: {
              titleSnapshot: "Inherited warmup",
              isVisible: true,
              metadata: {}
            }
          }
        }
      }
    ]);

    await createCourseGroup(teacherUser, "course-1", { title: "Team A" });

    expect(tx.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        kind: "activity",
        titleSnapshot: "Inherited warmup",
        activityId: "activity-1",
        courseGroupActivityId: "assignment-group-1"
      })
    });
  });

  it("removes the course-wide policy while leaving group assignments group-managed", async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "activity-1",
      courseId: "course-1",
      metadata: {
        allGroupsAssignment: { enabled: true },
        researchTags: []
      }
    });
    tx.activity.update.mockResolvedValue({ id: "activity-1" });
    tx.courseGroupActivity.findMany.mockResolvedValue([
      { id: "assignment-1", metadata: { assignmentScope: "course_all_groups", enablePerGroupSettings: false, note: "keep me" } },
      { id: "assignment-2", metadata: { note: "already local" } }
    ]);
    tx.courseGroupActivity.update.mockResolvedValue({ id: "assignment-1" });
    tx.activity.findFirst.mockResolvedValue({ id: "activity-1" });

    await expect(removeActivityFromAllCourseGroupsPolicy(teacherUser, "course-1", "activity-1")).resolves.toEqual({
      id: "activity-1"
    });

    expect(tx.activity.update).toHaveBeenCalledWith({
      where: { id: "activity-1" },
      data: {
        metadata: { researchTags: [] }
      }
    });
    expect(tx.courseGroupActivity.update).toHaveBeenCalledTimes(1);
    expect(tx.courseGroupActivity.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        metadata: { note: "keep me" }
      }
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

  it("omits hidden assignments from student group details", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findFirst
      .mockResolvedValueOnce({
        id: "group-1",
        courseId: "course-1",
        status: "published",
        availableFrom: null,
        availableUntil: null
      })
      .mockResolvedValueOnce({
        id: "group-1",
        courseId: "course-1",
        activities: [{ id: "visible-assignment" }, { id: "hidden-assignment" }],
        participants: [{ id: "participant-1", userId: "student-1" }],
        hiddenCourseMaterials: []
      })
      .mockResolvedValueOnce({ id: "group-1" });
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1", userId: "student-1" });
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      {
        id: "visible-item",
        parentId: null,
        isVisible: true,
        groupId: "group-1",
        kind: "activity",
        activityId: "activity-1",
        courseGroupActivityId: "visible-assignment"
      },
      {
        id: "hidden-item",
        parentId: null,
        isVisible: false,
        groupId: "group-1",
        kind: "activity",
        activityId: "activity-2",
        courseGroupActivityId: "hidden-assignment"
      }
    ]);

    await expect(getCourseGroup(studentUser, "course-1", "group-1")).resolves.toMatchObject({
      activities: [{ id: "visible-assignment" }]
    });
  });

  it("rejects assigned activities hidden by their own content placement", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findFirst
      .mockResolvedValueOnce({
        id: "group-1",
        courseId: "course-1",
        status: "published",
        availableFrom: null,
        availableUntil: null
      })
      .mockResolvedValueOnce({ id: "group-1" });
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1", userId: "student-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      activityId: "activity-1",
      availableFrom: null,
      availableUntil: null,
      activity: { id: "activity-1" }
    });
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      {
        id: "group-activity-1",
        parentId: null,
        isVisible: false,
        groupId: "group-1",
        kind: "activity",
        activityId: "activity-1",
        courseGroupActivityId: "assignment-1"
      }
    ]);

    await expect(getGroupAssignedActivity(studentUser, "course-1", "group-1", "activity-1")).rejects.toMatchObject({
      status: 403,
      code: "GROUP_ACTIVITY_HIDDEN"
    });
  });

  it("rejects assigned activities inherited from a hidden course folder", async () => {
    authMocks.canManageCourse.mockResolvedValue(false);
    mockPrisma.courseGroup.findFirst
      .mockResolvedValueOnce({
        id: "group-1",
        courseId: "course-1",
        status: "published",
        availableFrom: null,
        availableUntil: null
      })
      .mockResolvedValueOnce({ id: "group-1" });
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1", userId: "student-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      activityId: "activity-1",
      availableFrom: null,
      availableUntil: null,
      activity: { id: "activity-1" }
    });
    mockPrisma.courseContentItem.findMany.mockResolvedValue([
      {
        id: "hidden-folder",
        parentId: null,
        isVisible: false,
        groupId: null,
        kind: "folder",
        activityId: null,
        courseGroupActivityId: null
      },
      {
        id: "course-activity-1",
        parentId: "hidden-folder",
        isVisible: true,
        groupId: null,
        kind: "activity",
        activityId: "activity-1",
        courseGroupActivityId: null
      },
      {
        id: "group-activity-1",
        parentId: null,
        isVisible: true,
        groupId: "group-1",
        kind: "activity",
        activityId: "activity-1",
        courseGroupActivityId: "assignment-1"
      }
    ]);

    await expect(getGroupAssignedActivity(studentUser, "course-1", "group-1", "activity-1")).rejects.toMatchObject({
      status: 403,
      code: "GROUP_ACTIVITY_HIDDEN"
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

  it("rejects assigning an activity contained by a Test", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue(null);

    await expect(
      assignActivityToGroup(teacherUser, "course-1", "group-1", { activityId: "test-child-1" })
    ).rejects.toMatchObject({ status: 404 });

    expect(mockPrisma.activity.findFirst).toHaveBeenCalledWith({
      where: { id: "test-child-1", courseId: "course-1", testItem: null },
      include: { activityType: true }
    });
    expect(mockPrisma.courseGroupActivity.create).not.toHaveBeenCalled();
  });

  it("rejects formative Test assignment", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "test-activity-1",
      courseId: "course-1",
      activityType: { key: "test" }
    });

    await expect(
      assignActivityToGroup(teacherUser, "course-1", "group-1", {
        activityId: "test-activity-1",
        metadata: { assessmentMode: "formative" }
      })
    ).rejects.toMatchObject({ status: 400, code: "TEST_SUMMATIVE_ONLY" });
  });

  it("assigns a Test as one summative group activity with one gradebook item", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue({
      id: "test-activity-1",
      courseId: "course-1",
      title: "Midterm",
      activityType: { key: "test" }
    });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue(null);

    await assignActivityToGroup(teacherUser, "course-1", "group-1", {
      activityId: "test-activity-1",
      metadata: { assessmentMode: "summative" },
      gradebookSettings: { pointsPossible: 40 },
      contentPlacement: { isVisible: true }
    });

    expect(tx.courseGroupActivity.create).toHaveBeenCalledTimes(1);
    expect(tx.courseGroupActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activityId: "test-activity-1",
        groupId: "group-1",
        metadata: { assessmentMode: "summative" }
      })
    }));
    expect(tx.gradebookItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.gradebookItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        activityId: "test-activity-1",
        groupActivityId: "assignment-created",
        pointsPossible: 40
      })
    }));
    expect(tx.courseContentItem.create).toHaveBeenCalledTimes(1);
  });

  it("creates a gradebook item when assigning an activity to a group", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue({ id: "activity-1", courseId: "course-1", title: "Trace loops" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue(null);

    await assignActivityToGroup(teacherUser, "course-1", "group-1", {
      activityId: "activity-1"
    });

    expect(tx.courseGroupActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: "group-1",
          activityId: "activity-1"
        })
      })
    );
    expect(tx.gradebookItem.upsert).toHaveBeenCalledWith({
      where: { groupActivityId: "assignment-created" },
      update: {},
      create: {
        courseId: "course-1",
        groupId: "group-1",
        groupActivityId: "assignment-created",
        activityId: "activity-1",
        titleSnapshot: "Trace loops"
      }
    });
  });

  it("creates group content placement when assigning an activity to a group", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue({ id: "activity-1", courseId: "course-1", title: "Trace loops" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue(null);
    tx.courseContentItem.findFirst.mockResolvedValueOnce({ id: "folder-1" }).mockResolvedValueOnce(null);

    await assignActivityToGroup(teacherUser, "course-1", "group-1", {
      activityId: "activity-1",
      contentPlacement: {
        parentId: "folder-1",
        isVisible: false
      }
    });

    expect(tx.courseContentItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        parentId: "folder-1",
        kind: "activity",
        titleSnapshot: "Trace loops",
        isVisible: false,
        activityId: "activity-1",
        courseGroupActivityId: "assignment-created"
      })
    });
  });

  it("applies gradebook policy settings when assigning a summative group activity", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.activity.findFirst.mockResolvedValue({ id: "activity-1", courseId: "course-1", title: "Trace loops" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue(null);

    await assignActivityToGroup(teacherUser, "course-1", "group-1", {
      activityId: "activity-1",
      metadata: { assessmentMode: "summative" },
      gradebookSettings: {
        pointsPossible: 25,
        gradingMode: "pass_fail",
        passThresholdPoints: 18,
        passThresholdOutOf: 25,
        attemptLimitMode: "max_attempts",
        maxAttempts: 3,
        gradeStrategy: "best"
      }
    });

    expect(tx.gradebookItem.upsert).toHaveBeenCalledWith({
      where: { groupActivityId: "assignment-created" },
      update: expect.objectContaining({
        pointsPossible: 25,
        gradingMode: "pass_fail",
        passThresholdPoints: 18,
        passThresholdOutOf: 25,
        attemptLimitMode: "max_attempts",
        maxAttempts: 3,
        gradeStrategy: "best"
      }),
      create: expect.objectContaining({
        courseId: "course-1",
        groupId: "group-1",
        groupActivityId: "assignment-created",
        activityId: "activity-1",
        titleSnapshot: "Trace loops",
        pointsPossible: 25,
        gradingMode: "pass_fail",
        maxAttempts: 3
      })
    });
  });

  it("rejects changing an assigned Test to formative", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      metadata: { assessmentMode: "summative" },
      activity: { activityType: { key: "test" } }
    });

    await expect(
      updateGroupActivityAssignment(teacherUser, "course-1", "group-1", "assignment-1", {
        metadata: { assessmentMode: "formative" }
      })
    ).rejects.toMatchObject({ status: 400, code: "TEST_SUMMATIVE_ONLY" });

    expect(mockPrisma.courseGroupActivity.update).not.toHaveBeenCalled();
  });

  it("allows course-wide group assignments to be reordered inside a group", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      metadata: { assignmentScope: "course_all_groups" }
    });
    mockPrisma.courseGroupActivity.update.mockResolvedValue({ id: "assignment-1", position: 2 });

    await expect(updateGroupActivityAssignment(teacherUser, "course-1", "group-1", "assignment-1", { position: 2 })).resolves.toEqual({
      id: "assignment-1",
      position: 2
    });
  });

  it("allows course-wide group assignment availability to be edited inside a group", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      metadata: { assignmentScope: "course_all_groups" }
    });
    mockPrisma.courseGroupActivity.update.mockResolvedValue({ id: "assignment-1" });

    await expect(
      updateGroupActivityAssignment(teacherUser, "course-1", "group-1", "assignment-1", {
        availableFrom: "2026-05-18T13:00:00.000Z",
        availableUntil: "2026-05-19T13:00:00.000Z"
      })
    ).resolves.toEqual({ id: "assignment-1" });
  });

  it("blocks course-wide group assignment availability edits when per-group settings are disabled", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      metadata: { assignmentScope: "course_all_groups", enablePerGroupSettings: false }
    });

    await expect(
      updateGroupActivityAssignment(teacherUser, "course-1", "group-1", "assignment-1", {
        availableFrom: "2026-05-18T13:00:00.000Z"
      })
    ).rejects.toMatchObject({ status: 400, code: "COURSE_WIDE_GROUP_ACTIVITY_LOCKED" });
  });

  it("blocks local metadata edits for course-wide group assignments", async () => {
    mockPrisma.courseGroup.findFirst.mockResolvedValue({ id: "group-1", courseId: "course-1" });
    mockPrisma.courseGroupActivity.findFirst.mockResolvedValue({
      id: "assignment-1",
      groupId: "group-1",
      metadata: { assignmentScope: "course_all_groups" }
    });

    await expect(
      updateGroupActivityAssignment(teacherUser, "course-1", "group-1", "assignment-1", {
        metadata: { assignmentScope: "local" }
      })
    ).rejects.toMatchObject({ status: 400, code: "COURSE_WIDE_GROUP_ACTIVITY_LOCKED" });
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
