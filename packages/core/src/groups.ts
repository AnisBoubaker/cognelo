import bcrypt from "bcryptjs";
import {
  CourseAllGroupsActivityAssignmentInputSchema,
  CourseGroupStatus,
  CourseGroupActivityInputSchema,
  CourseGroupActivityUpdateSchema,
  CourseGroupDeleteInputSchema,
  CourseGroupInputSchema,
  CourseGroupParticipantInputSchema,
  GradebookItemSettingsInputSchema,
  type CourseGroupParticipantRole,
  CourseGroupMaterialInputSchema,
  CourseGroupMaterialUpdateSchema,
  CourseGroupUpdateSchema
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import type { ActivityAssignmentOverrideField, CurrentUser } from "@cognelo/contracts";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { assertCanManageCourse, assertCanViewCourse, canManageCourse, isAdmin } from "./authorization";
import { listContentItems } from "./course-content";
import { AppError, notFound } from "./errors";

type StudentAccessDb = Pick<typeof prisma, "role" | "userRole" | "courseMembership">;
type GradebookItemDb = Pick<typeof prisma, "gradebookItem">;
type GradebookItemSettingsInput = ReturnType<typeof normalizeGradebookItemSettings>;
type GroupActivityInput = ReturnType<typeof CourseGroupActivityInputSchema.parse>;
type CourseWideContentPlacement = NonNullable<ReturnType<typeof CourseAllGroupsActivityAssignmentInputSchema.parse>["contentPlacement"]>;
type CourseWideAssignmentMetadata = {
  enabled?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
  enablePerGroupSettings?: boolean;
  assessmentMode?: "formative" | "summative";
  requireSafeExamBrowser?: boolean;
  gradebookSettings?: GradebookItemSettingsInput;
  contentPlacement?: CourseWideContentPlacement;
  assignedGroupIds?: string[];
  futureGroupsAssigned?: boolean;
};

const COURSE_WIDE_ASSIGNMENT_METADATA_KEY = "allGroupsAssignment";
const COURSE_WIDE_ASSIGNMENT_SCOPE = "course_all_groups";
const COURSE_ACTIVITY_SETTINGS_SCOPE = "course_activity_settings";
const SUMMATIVE_OVERRIDE_FIELDS = new Set<ActivityAssignmentOverrideField>([
  "availableFrom",
  "availableUntil",
  "visibility",
  "requireSafeExamBrowser",
  "pointsPossible",
  "grading",
  "attempts",
  "gradeStrategy"
]);
const FORMATIVE_OVERRIDE_FIELDS = new Set<ActivityAssignmentOverrideField>([
  "availableFrom",
  "availableUntil",
  "visibility"
]);

const groupInclude = {
  materials: { orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }] },
  hiddenCourseMaterials: {
    select: {
      courseMaterialId: true
    }
  },
  activities: {
    include: {
      activity: {
        include: { activityType: true, bankActivity: true, activityVersion: true }
      }
    },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  },
  participants: {
    include: {
      user: {
        select: { id: true, email: true, name: true }
      }
    },
    orderBy: [{ createdAt: "asc" as const }]
  }
};

export async function listCourseGroups(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const isManager = await canManageCourse(user, courseId);
  return prisma.courseGroup.findMany({
    where: {
      courseId,
      ...(isManager
        ? {}
        : {
            ...buildVisibleGroupWhere(),
            participants: {
              some: { userId: user.id }
            }
          })
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getCourseGroup(user: CurrentUser, courseId: string, groupId: string) {
  const isManager = await canManageCourse(user, courseId);
  await assertCanViewGroup(user, courseId, groupId);
  const group = await prisma.courseGroup.findFirst({
    where: {
      id: groupId,
      courseId
    },
    include: groupInclude
  });
  if (!group) {
    throw notFound("Course group");
  }
  const visibleAssignmentIds = isManager
    ? null
    : new Set(
        (await listContentItems(user, courseId, { groupId, visibleOnly: true }))
          .map((item) => item.courseGroupActivityId)
          .filter((id): id is string => typeof id === "string")
      );
  const visibleActivities = visibleAssignmentIds
    ? group.activities.filter((assignment) => visibleAssignmentIds.has(assignment.id))
    : group.activities;
  return {
    ...group,
    activities: isManager
      ? visibleActivities
      : visibleActivities.map((assignment) => assignmentRequiresSafeExamBrowser(assignment.metadata)
        ? {
            ...assignment,
            config: {},
            activity: {
              ...assignment.activity,
              description: "",
              config: {},
              metadata: {},
              bankActivity: null,
              activityVersion: null
            }
          }
        : assignment),
    participants: isManager ? group.participants : group.participants.filter((participant) => participant.userId === user.id),
    hiddenCourseMaterialIds: group.hiddenCourseMaterials.map((entry) => entry.courseMaterialId)
  };
}

export async function createCourseGroup(user: CurrentUser, courseId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseGroupInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const group = await tx.courseGroup.create({
      data: {
        ...data,
        status: "draft",
        courseId,
        createdById: user.id,
        participants: {
          create: {
            userId: user.id,
            role: "teacher",
            firstName: firstNameFromName(user.name),
            lastName: lastNameFromName(user.name),
            email: user.email
          }
        }
      }
    });

    return group;
  });
}

export async function getCourseActivityAssignmentSettings(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const activity = await assertActivityBelongsToCourse(courseId, activityId);
  const [groups, coursePlacement] = await Promise.all([
    prisma.courseGroup.findMany({
      where: { courseId },
      include: {
        activities: {
          where: { activityId },
          include: {
            gradebookItem: true,
            contentItems: {
              where: { kind: "activity" },
              orderBy: [{ createdAt: "asc" }],
              take: 1
            }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.courseContentItem.findFirst({
      where: { courseId, groupId: null, activityId, kind: "activity" },
      select: { id: true, parentId: true, titleSnapshot: true, isVisible: true, metadata: true }
    })
  ]);
  const visibilityOverrides = coursePlacement
    ? await prisma.courseGroupContentVisibilityOverride.findMany({
        where: { contentItemId: coursePlacement.id },
        select: { groupId: true, isVisible: true }
      })
    : [];
  const visibilityByGroupId = new Map(visibilityOverrides.map((override) => [override.groupId, override.isVisible]));
  const rule = getCourseWideAssignmentMetadata(activity.metadata);
  const assessmentMode = activity.activityType?.key === "test" ? "summative" : rule?.assessmentMode ?? "formative";
  const generalGradebookSettings = normalizeGradebookItemSettings(rule?.gradebookSettings);
  const generalContentPlacement = {
    parentId: coursePlacement?.parentId ?? rule?.contentPlacement?.parentId ?? null,
    titleSnapshot: rule?.contentPlacement?.titleSnapshot ?? coursePlacement?.titleSnapshot ?? activity.title,
    isVisible: coursePlacement?.isVisible ?? rule?.contentPlacement?.isVisible ?? true,
    metadata: rule?.contentPlacement?.metadata ?? asMetadataRecord(coursePlacement?.metadata)
  };
  const general = {
    availableFrom: rule?.availableFrom ?? null,
    availableUntil: rule?.availableUntil ?? null,
    assessmentMode,
    requireSafeExamBrowser: assessmentMode === "summative" && rule?.requireSafeExamBrowser === true,
    gradebookSettings: generalGradebookSettings,
    contentPlacement: generalContentPlacement
  };
  const hasStoredAssignments = groups.some((group) => group.activities.length > 0);

  return {
    general,
    groups: groups.map((group) => {
      const assignment = group.activities[0] ?? null;
      const assigned = assignment ? true : !hasStoredAssignments;
      const assignmentGradebookSettings = assignment?.gradebookItem
        ? gradebookSettingsFromItem(assignment.gradebookItem)
        : generalGradebookSettings;
      const assignmentContentPlacement = assignment?.contentItems[0]
        ? {
            parentId: assignment.contentItems[0].parentId,
            titleSnapshot: assignment.contentItems[0].titleSnapshot,
            isVisible: visibilityByGroupId.get(group.id) ?? assignment.contentItems[0].isVisible,
            metadata: asMetadataRecord(assignment.contentItems[0].metadata)
          }
        : {
            ...generalContentPlacement,
            isVisible: visibilityByGroupId.get(group.id) ?? generalContentPlacement.isVisible
          };
      const storedOverrideFields = assignment
        ? readStoredOverrideFields(assignment.metadata) ?? inferLegacyOverrideFields({
            assignment,
            assignmentContentPlacement,
            assignmentGradebookSettings,
            general
          })
        : [];
      const allowedOverrideFields = assessmentMode === "summative" ? SUMMATIVE_OVERRIDE_FIELDS : FORMATIVE_OVERRIDE_FIELDS;
      const overrideFields = storedOverrideFields.filter((field) => allowedOverrideFields.has(field));

      return {
        groupId: group.id,
        title: group.title,
        assigned,
        assignmentId: assignment?.id ?? null,
        overrideFields,
        availableFrom: assignment?.availableFrom?.toISOString() ?? general.availableFrom,
        availableUntil: assignment?.availableUntil?.toISOString() ?? general.availableUntil,
        requireSafeExamBrowser:
          assessmentMode === "summative"
            ? assignmentRequiresSafeExamBrowser(assignment?.metadata) || (!overrideFields.includes("requireSafeExamBrowser") && general.requireSafeExamBrowser)
            : false,
        gradebookSettings: assignmentGradebookSettings,
        contentPlacement: assignmentContentPlacement
      };
    })
  };
}

export async function assignActivityToAllCourseGroups(user: CurrentUser, courseId: string, activityId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseAllGroupsActivityAssignmentInputSchema.parse(input);
  validateAvailability(data.availableFrom, data.availableUntil);
  const activity = await assertActivityBelongsToCourse(courseId, activityId);
  assertTestAssignmentIsSummative(activity, data.assessmentMode);
  assertSafeExamBrowserIsSummative(data.assessmentMode, data.requireSafeExamBrowser);
  await assertTestReadyForCompositeExecution(courseId, activity);
  const gradebookSettings = normalizeGradebookItemSettings(data.gradebookSettings);

  return prisma.$transaction(async (tx) => {
    const [groups, coursePlacement] = await Promise.all([
      tx.courseGroup.findMany({
        where: { courseId },
        include: {
          activities: {
            where: { activityId },
            select: { id: true, activityId: true, position: true, metadata: true }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      }),
      tx.courseContentItem.findFirst({
        where: { courseId, groupId: null, activityId, kind: "activity" },
        select: { id: true, parentId: true, isVisible: true }
      })
    ]);
    const canonicalParentId = coursePlacement?.parentId ?? data.contentPlacement?.parentId ?? null;
    const generalContentPlacement = data.contentPlacement
      ? {
          ...data.contentPlacement,
          parentId: canonicalParentId,
          isVisible: data.contentPlacement.isVisible ?? coursePlacement?.isVisible ?? true
        }
      : undefined;
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const requestedAssignments = data.groupAssignments ?? groups.map((group) => ({
      groupId: group.id,
      assigned: true,
      overrideFields: [],
      availableFrom: data.availableFrom,
      availableUntil: data.availableUntil,
      requireSafeExamBrowser: data.requireSafeExamBrowser,
      gradebookSettings,
      contentPlacement: data.contentPlacement
    }));
    const unknownGroup = requestedAssignments.find((assignment) => !groupById.has(assignment.groupId));
    if (unknownGroup) {
      throw new AppError(400, "COURSE_ACTIVITY_SETTINGS_GROUP_INVALID", "Every group setting must belong to the course.");
    }
    const requestedByGroupId = new Map(requestedAssignments.map((assignment) => [assignment.groupId, assignment]));
    const assignedGroupIds = requestedAssignments.filter((assignment) => assignment.assigned).map((assignment) => assignment.groupId);
    const activityMetadata = asMetadataRecord(activity.metadata);
    await tx.activity.update({
      where: { id: activityId },
      data: {
        metadata: {
          ...activityMetadata,
          [COURSE_WIDE_ASSIGNMENT_METADATA_KEY]: {
            enabled: assignedGroupIds.length > 0 && assignedGroupIds.length === groups.length,
            availableFrom: data.availableFrom ?? null,
            availableUntil: data.availableUntil ?? null,
            enablePerGroupSettings: true,
            futureGroupsAssigned: false,
            assessmentMode: data.assessmentMode,
            ...(data.requireSafeExamBrowser ? { requireSafeExamBrowser: true } : {}),
            ...(data.assessmentMode === "summative" ? { gradebookSettings } : {}),
            ...(generalContentPlacement ? { contentPlacement: generalContentPlacement } : {}),
            assignedGroupIds
          }
        } as Prisma.InputJsonValue
      }
    });
    if (coursePlacement && generalContentPlacement) {
      await tx.courseContentItem.update({
        where: { id: coursePlacement.id },
        data: { isVisible: generalContentPlacement.isVisible }
      });
    }

    await Promise.all(
      groups.map(async (group) => {
        const existingAssignment = group.activities.find((assignment) => assignment.activityId === activityId);
        const requested = requestedByGroupId.get(group.id);
        if (!requested?.assigned) {
          if (coursePlacement) {
            await tx.courseGroupContentVisibilityOverride.deleteMany({
              where: { groupId: group.id, contentItemId: coursePlacement.id }
            });
          }
          if (existingAssignment) {
            await tx.courseGroupActivity.delete({ where: { id: existingAssignment.id } });
          }
          return;
        }
        const allowedFields = data.assessmentMode === "summative" ? SUMMATIVE_OVERRIDE_FIELDS : FORMATIVE_OVERRIDE_FIELDS;
        const overrideFields = requested.overrideFields.filter((field) => allowedFields.has(field));
        const groupAvailableFrom = overrideFields.includes("availableFrom") ? requested.availableFrom : data.availableFrom;
        const groupAvailableUntil = overrideFields.includes("availableUntil") ? requested.availableUntil : data.availableUntil;
        validateAvailability(groupAvailableFrom, groupAvailableUntil);
        const requireSafeExamBrowser = data.assessmentMode === "summative" && (
          overrideFields.includes("requireSafeExamBrowser")
            ? requested.requireSafeExamBrowser === true
            : data.requireSafeExamBrowser
        );
        const requestedGradebookSettings = normalizeGradebookItemSettings(requested.gradebookSettings);
        const effectiveGradebookSettings = data.assessmentMode === "summative"
          ? mergeGradebookSettings(gradebookSettings, requestedGradebookSettings, overrideFields)
          : gradebookSettings;
        const requestedPlacement = requested.contentPlacement ?? generalContentPlacement;
        const effectivePlacement = {
          parentId: canonicalParentId,
          titleSnapshot: requestedPlacement?.titleSnapshot ?? generalContentPlacement?.titleSnapshot ?? activity.title,
          isVisible: overrideFields.includes("visibility")
            ? requestedPlacement?.isVisible ?? true
            : generalContentPlacement?.isVisible ?? true,
          metadata: requestedPlacement?.metadata ?? generalContentPlacement?.metadata ?? {}
        };
        if (coursePlacement) {
          if (
            overrideFields.includes("visibility") &&
            effectivePlacement.isVisible !== (generalContentPlacement?.isVisible ?? coursePlacement.isVisible)
          ) {
            await tx.courseGroupContentVisibilityOverride.upsert({
              where: {
                groupId_contentItemId: {
                  groupId: group.id,
                  contentItemId: coursePlacement.id
                }
              },
              create: {
                groupId: group.id,
                contentItemId: coursePlacement.id,
                isVisible: effectivePlacement.isVisible
              },
              update: { isVisible: effectivePlacement.isVisible }
            });
          } else {
            await tx.courseGroupContentVisibilityOverride.deleteMany({
              where: { groupId: group.id, contentItemId: coursePlacement.id }
            });
          }
        }
        const groupAssignmentMetadata = buildCourseActivitySettingsMetadata(
          existingAssignment?.metadata,
          overrideFields,
          data.assessmentMode,
          requireSafeExamBrowser
        );
        const assignment = await tx.courseGroupActivity.upsert({
          where: {
            groupId_activityId: {
              groupId: group.id,
              activityId
            },
          },
          update: {
            availableFrom: parseDateInput(groupAvailableFrom),
            availableUntil: parseDateInput(groupAvailableUntil),
            metadata: groupAssignmentMetadata
          },
          create: {
            groupId: group.id,
            activityId,
            availableFrom: parseDateInput(groupAvailableFrom),
            availableUntil: parseDateInput(groupAvailableUntil),
            metadata: groupAssignmentMetadata,
            position: existingAssignment?.position ?? group.activities.length
          }
        });
        await ensureGradebookItemForAssignment(tx, {
          courseId,
          groupId: group.id,
          groupActivityId: assignment.id,
          activityId,
          titleSnapshot: activity.title,
          gradebookSettings: effectiveGradebookSettings
        });
        await ensureAssignmentContentItem(tx, {
          courseId,
          groupId: group.id,
          groupActivityId: assignment.id,
          activityId,
          title: activity.title,
          placement: effectivePlacement
        });
      })
    );

    return tx.activity.findFirst({
      where: { id: activityId, courseId },
      include: { activityType: true, bankActivity: true, activityVersion: true }
    });
  });
}

export async function removeActivityFromAllCourseGroupsPolicy(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanManageCourse(user, courseId);
  const activity = await assertActivityBelongsToCourse(courseId, activityId);

  return prisma.$transaction(async (tx) => {
    const activityMetadata = asMetadataRecord(activity.metadata);
    const { [COURSE_WIDE_ASSIGNMENT_METADATA_KEY]: _removedRule, ...nextActivityMetadata } = activityMetadata;
    await tx.activity.update({
      where: { id: activityId },
      data: {
        metadata: nextActivityMetadata
      }
    });

    const assignments = await tx.courseGroupActivity.findMany({
      where: {
        activityId,
        group: { courseId }
      },
      select: {
        id: true,
        metadata: true
      }
    });

    await Promise.all(
      assignments
        .filter((assignment) => isCourseWideGroupAssignment(assignment.metadata))
        .map((assignment) =>
          tx.courseGroupActivity.update({
            where: { id: assignment.id },
            data: {
              metadata: removeCourseWideGroupAssignmentMarker(assignment.metadata)
            }
          })
        )
    );

    return tx.activity.findFirst({
      where: { id: activityId, courseId },
      include: { activityType: true, bankActivity: true, activityVersion: true }
    });
  });
}

export async function updateCourseGroup(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseGroupUpdateSchema.parse(input);
  await assertGroupBelongsToCourse(courseId, groupId);
  return prisma.courseGroup.update({
    where: { id: groupId },
    data: {
      title: data.title,
      status: data.status,
      availableFrom: data.availableFrom !== undefined ? parseDateInput(data.availableFrom) : undefined,
      availableUntil: data.availableUntil !== undefined ? parseDateInput(data.availableUntil) : undefined
    }
  });
}

export async function deleteCourseGroup(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  const data = CourseGroupDeleteInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const groups = await tx.courseGroup.findMany({
      where: { courseId },
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    });
    if (!groups.some((group) => group.id === groupId)) throw notFound("Course group");
    if (groups.length <= 1) {
      throw new AppError(400, "COURSE_LAST_GROUP_DELETE_FORBIDDEN", "The last group in a course cannot be deleted.");
    }

    const participants = await tx.courseGroupParticipant.findMany({ where: { groupId } });
    const learnerParticipants = participants.filter((participant) => participant.role === "student");

    if (data.action === "move") {
      if (data.targetGroupId === groupId) {
        throw new AppError(400, "GROUP_MOVE_TARGET_SAME", "Participants must be moved to a different group.");
      }
      const targetExists = groups.some((group) => group.id === data.targetGroupId);
      if (!targetExists) throw new AppError(400, "GROUP_MOVE_TARGET_INVALID", "The destination group must belong to this course.");
      const targetParticipants = await tx.courseGroupParticipant.findMany({ where: { groupId: data.targetGroupId } });
      const targetEmails = new Set(targetParticipants.map((participant) => participant.email.toLowerCase()));
      const participantsToCreate = participants.filter((participant) => !targetEmails.has(participant.email.toLowerCase()));
      if (participantsToCreate.length) {
        await tx.courseGroupParticipant.createMany({
          data: participantsToCreate.map(({ userId, role, firstName, lastName, email, externalId }) => ({
            groupId: data.targetGroupId, userId, role, firstName, lastName, email, externalId
          }))
        });
      }
      await tx.courseGroup.delete({ where: { id: groupId } });
      return { ok: true as const, movedParticipantCount: participantsToCreate.length, skippedDuplicateCount: participants.length - participantsToCreate.length };
    }

    if (learnerParticipants.length && !data.confirmParticipantDeletion) {
      throw new AppError(400, "GROUP_PARTICIPANT_DELETE_CONFIRMATION_REQUIRED", "Permanent participant deletion requires explicit confirmation.");
    }
    const studentUserIds = [...new Set(learnerParticipants.map((participant) => participant.userId).filter((id): id is string => Boolean(id)))];
    await tx.courseGroup.delete({ where: { id: groupId } });
    for (const userId of studentUserIds) {
      const otherStudentParticipant = await tx.courseGroupParticipant.findMany({
        where: { userId, role: "student", group: { courseId } }, select: { id: true }, take: 1
      });
      if (!otherStudentParticipant.length) {
        await tx.courseMembership.deleteMany({ where: { courseId, userId, role: "student" } });
      }
    }
    return { ok: true as const, deletedParticipantCount: participants.length };
  });
}

export async function listGroupMaterials(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewGroup(user, courseId, groupId);
  return prisma.courseGroupMaterial.findMany({
    where: { groupId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function createGroupMaterial(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupMaterialInputSchema.parse(input);
  await assertValidGroupMaterialParent(groupId, data.parentId);
  return prisma.courseGroupMaterial.create({
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue,
      groupId,
      createdById: user.id
    }
  });
}

export async function updateGroupMaterial(user: CurrentUser, courseId: string, groupId: string, materialId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupMaterialUpdateSchema.parse(input);
  const material = await prisma.courseGroupMaterial.findFirst({ where: { id: materialId, groupId } });
  if (!material) {
    throw notFound("Group material");
  }
  if (data.parentId === materialId) {
    throw new AppError(400, "INVALID_MATERIAL_PARENT", "A material cannot be moved inside itself.");
  }
  await assertValidGroupMaterialParent(groupId, data.parentId);
  return prisma.courseGroupMaterial.update({
    where: { id: materialId },
    data: {
      ...data,
      metadata: data.metadata as Prisma.InputJsonValue | undefined
    }
  });
}

export async function getGroupMaterialForDownload(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanViewGroup(user, courseId, groupId);
  const material = await prisma.courseGroupMaterial.findFirst({
    where: { id: materialId, groupId, kind: "file" }
  });
  if (!material) {
    throw notFound("Group material");
  }
  return material;
}

export async function getCourseMaterialForGroupDownload(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanViewGroup(user, courseId, groupId);
  await assertCourseMaterialBelongsToCourse(courseId, materialId);

  const hiddenEntries = await prisma.courseGroupHiddenCourseMaterial.findMany({
    where: { groupId },
    select: { courseMaterialId: true }
  });
  const hiddenCourseMaterialIds = new Set(hiddenEntries.map((entry) => entry.courseMaterialId));

  const material = await prisma.courseMaterial.findFirst({
    where: { id: materialId, courseId, kind: "file" }
  });
  if (!material) {
    throw notFound("Course material");
  }

  if (hiddenCourseMaterialIds.has(materialId)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this course material in the group workspace.");
  }

  if (material.parentId) {
    const courseMaterials = await prisma.courseMaterial.findMany({
      where: { courseId },
      select: { id: true, parentId: true }
    });
    const parentById = new Map<string, string | null>(courseMaterials.map((entry) => [entry.id, entry.parentId]));
    let parentId: string | null = material.parentId;
    while (parentId) {
      if (hiddenCourseMaterialIds.has(parentId)) {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this course material in the group workspace.");
      }
      parentId = parentById.get(parentId) ?? null;
    }
  }

  return material;
}

export async function deleteGroupMaterial(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const material = await prisma.courseGroupMaterial.findFirst({ where: { id: materialId, groupId } });
  if (!material) {
    throw notFound("Group material");
  }
  await prisma.courseGroupMaterial.delete({ where: { id: materialId } });
  return { ok: true };
}

export async function hideCourseMaterialForGroup(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  await assertCourseMaterialBelongsToCourse(courseId, materialId);

  await prisma.courseGroupHiddenCourseMaterial.upsert({
    where: {
      groupId_courseMaterialId: {
        groupId,
        courseMaterialId: materialId
      }
    },
    update: {},
    create: {
      groupId,
      courseMaterialId: materialId
    }
  });

  return { ok: true };
}

export async function unhideCourseMaterialForGroup(user: CurrentUser, courseId: string, groupId: string, materialId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  await assertCourseMaterialBelongsToCourse(courseId, materialId);

  await prisma.courseGroupHiddenCourseMaterial.deleteMany({
    where: {
      groupId,
      courseMaterialId: materialId
    }
  });

  return { ok: true };
}

export async function listGroupActivityAssignments(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  return prisma.courseGroupActivity.findMany({
    where: { groupId },
    include: {
      activity: {
        include: { activityType: true, bankActivity: true, activityVersion: true }
      }
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
}

export async function getGroupAssignedActivity(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const group = await assertCanViewGroup(user, courseId, groupId);
  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { groupId, activityId },
    include: {
      activity: {
        include: { activityType: true, bankActivity: true, activityVersion: true }
      }
    }
  });

  if (!assignment) {
    throw notFound("Group activity assignment");
  }

  if (!(isAdmin(user) || (await canManageCourse(user, courseId)))) {
    const now = new Date();
    if (
      group.status !== "published" ||
      (assignment.availableFrom && assignment.availableFrom > now)
    ) {
      throw new AppError(403, "GROUP_ACTIVITY_NOT_AVAILABLE", "This activity is not currently available in the group.");
    }

    const visibleContentItems = await listContentItems(user, courseId, { groupId, visibleOnly: true });
    if (!visibleContentItems.some((item) => item.courseGroupActivityId === assignment.id)) {
      throw new AppError(403, "GROUP_ACTIVITY_HIDDEN", "This activity is hidden in the group workspace.");
    }
  }

  return {
    ...assignment.activity,
    assignment: {
      id: assignment.id,
      availableFrom: assignment.availableFrom,
      availableUntil: assignment.availableUntil,
      config: assignment.config,
      metadata: assignment.metadata,
      position: assignment.position
    }
  };
}

export async function getGroupAssignedActivityAccess(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  return {
    activityId: activity.id,
    assignmentId: activity.assignment.id,
    title: activity.title,
    requiresSafeExamBrowser: assignmentRequiresSafeExamBrowser(activity.assignment.metadata),
    canBypass: isAdmin(user) || (await canManageCourse(user, courseId))
  };
}

export async function addGroupParticipant(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupParticipantInputSchema.parse(input);
  const normalizedEmail = data.email.toLowerCase();
  const normalizedExternalId = data.externalId?.trim() || null;
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const firstName = data.firstName?.trim() || (existingUser ? firstNameFromName(existingUser.name) : "");
  const lastName = data.lastName?.trim() || (existingUser ? lastNameFromName(existingUser.name) : "");

  if (!existingUser && (!firstName || !lastName)) {
    throw new AppError(400, "GROUP_PARTICIPANT_NAME_REQUIRED", "First name and last name are required for a new participant.");
  }
  if (
    data.assignedPassword &&
    existingUser &&
    (
      !existingUser.isActive ||
      existingUser.mustChangePassword ||
      !existingUser.emailVerifiedAt ||
      !(await bcrypt.compare(data.assignedPassword, existingUser.passwordHash))
    )
  ) {
    throw assignedPasswordAccountConflict();
  }

  const assignedPasswordHash = data.assignedPassword && !existingUser ? await bcrypt.hash(data.assignedPassword, 12) : null;

  try {
    const participant = await prisma.$transaction(async (tx) => {
      let linkedUserId = existingUser?.id ?? null;

      if (assignedPasswordHash) {
        const pendingParticipants = await tx.courseGroupParticipant.findMany({
          where: { email: normalizedEmail, userId: null },
          include: { group: { select: { courseId: true } } }
        });
        const createdUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: `${firstName} ${lastName}`.trim(),
            firstName,
            lastName,
            passwordHash: assignedPasswordHash,
            mustChangePassword: false,
            isActive: true,
            emailVerifiedAt: new Date()
          },
          select: { id: true }
        });
        linkedUserId = createdUser.id;

        await ensureStudentRole(createdUser.id, tx);
        const courseRoles = new Map<string, CourseGroupParticipantRole>([[courseId, "student"]]);
        for (const pendingParticipant of pendingParticipants) {
          const pendingCourseId = pendingParticipant.group.courseId;
          courseRoles.set(pendingCourseId, highestParticipantRole(courseRoles.get(pendingCourseId), pendingParticipant.role));
        }
        for (const [participantCourseId, role] of courseRoles) {
          await ensureMembershipsForGroupParticipant(createdUser.id, participantCourseId, role, tx);
        }
        await tx.courseGroupParticipant.updateMany({
          where: { email: normalizedEmail, userId: null },
          data: { userId: createdUser.id }
        });
      }

      const createdParticipant = await tx.courseGroupParticipant.create({
        data: {
          groupId,
          userId: linkedUserId,
          role: data.role,
          firstName,
          lastName,
          email: normalizedEmail,
          externalId: normalizedExternalId
        },
        include: {
          user: {
            select: { id: true, email: true, name: true }
          }
        }
      });

      if (existingUser) {
        await ensureMembershipsForGroupParticipant(existingUser.id, courseId, data.role, tx);
      }

      return createdParticipant;
    });

    return participant;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("groupId") &&
      error.meta.target.includes("email")
    ) {
      throw new AppError(400, "GROUP_PARTICIPANT_EXISTS", "This participant is already part of the group.");
    }
    if (
      data.assignedPassword &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw assignedPasswordAccountConflict();
    }
    throw error;
  }
}

function assignedPasswordAccountConflict() {
  return new AppError(
    409,
    "GROUP_PARTICIPANT_ASSIGNED_PASSWORD_ACCOUNT_CONFLICT",
    "An existing account for this email is not ready for immediate login with the assigned password. Its password was not changed."
  );
}

export async function lookupGroupParticipantCandidate(user: CurrentUser, courseId: string, email: string) {
  await assertCanManageCourse(user, courseId);
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) {
    return null;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true }
  });

  if (!existingUser) {
    return null;
  }

  return {
    id: existingUser.id,
    email: existingUser.email,
    firstName: firstNameFromName(existingUser.name),
    lastName: lastNameFromName(existingUser.name),
    name: existingUser.name
  };
}

export async function removeGroupParticipant(user: CurrentUser, courseId: string, groupId: string, participantId: string) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { id: participantId, groupId }
  });
  if (!participant) {
    throw notFound("Group participant");
  }
  if (participant.userId === user.id) {
    throw new AppError(400, "GROUP_PARTICIPANT_SELF_REMOVE_FORBIDDEN", "You cannot remove yourself from this group.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.courseGroupParticipant.delete({ where: { id: participantId } });
    if (participant.role === "student" && participant.userId) {
      const otherStudentGroups = await tx.courseGroupParticipant.findMany({
        where: {
          userId: participant.userId,
          role: "student",
          group: { courseId }
        },
        select: { id: true },
        take: 1
      });
      if (!otherStudentGroups.length) {
        await tx.courseMembership.deleteMany({
          where: {
            courseId,
            userId: participant.userId,
            role: "student"
          }
        });
      }
    }
  });
  return { ok: true };
}

export async function assignActivityToGroup(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupActivityInputSchema.parse(input);
  const activity = await assertActivityBelongsToCourse(courseId, data.activityId);
  assertTestAssignmentIsSummative(activity, data.metadata.assessmentMode);
  assertSafeExamBrowserIsSummative(data.metadata.assessmentMode, data.metadata.requireSafeExamBrowser);
  await assertTestReadyForCompositeExecution(courseId, activity);
  validateAvailability(data.availableFrom, data.availableUntil);

  const existing = await prisma.courseGroupActivity.findFirst({
    where: { groupId, activityId: data.activityId }
  });
  if (existing) {
    throw new AppError(400, "GROUP_ACTIVITY_EXISTS", "This activity is already assigned to the group.");
  }

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.courseGroupActivity.create({
      data: {
        groupId,
        activityId: data.activityId,
        availableFrom: parseDateInput(data.availableFrom),
        availableUntil: parseDateInput(data.availableUntil),
        config: data.config as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        position: data.position
      },
      include: {
        activity: {
          include: { activityType: true, bankActivity: true, activityVersion: true }
        }
      }
    });

    await ensureGradebookItemForAssignment(tx, {
      courseId,
      groupId,
      groupActivityId: assignment.id,
      activityId: assignment.activityId,
      titleSnapshot: activity.title,
      gradebookSettings: data.gradebookSettings ? normalizeGradebookItemSettings(data.gradebookSettings) : undefined
    });

    if (data.contentPlacement) {
      await ensureAssignmentContentItem(tx, {
        courseId,
        groupId,
        groupActivityId: assignment.id,
        activityId: assignment.activityId,
        title: activity.title,
        placement: data.contentPlacement
      });
    }

    return assignment;
  });
}

export async function updateGroupActivityAssignment(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  assignmentId: string,
  input: unknown
) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const data = CourseGroupActivityUpdateSchema.parse(input);
  validateAvailability(data.availableFrom, data.availableUntil);

  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { id: assignmentId, groupId },
    include: { activity: { include: { activityType: true } } }
  });
  if (!assignment) {
    throw notFound("Group activity assignment");
  }
  assertTestAssignmentIsSummative(
    assignment.activity,
    data.metadata !== undefined ? data.metadata.assessmentMode : asMetadataRecord(assignment.metadata).assessmentMode
  );
  const effectiveMetadata = data.metadata !== undefined ? data.metadata : asMetadataRecord(assignment.metadata);
  assertSafeExamBrowserIsSummative(effectiveMetadata.assessmentMode, effectiveMetadata.requireSafeExamBrowser);
  if (isCourseWideGroupAssignment(assignment.metadata) && !isAllowedCourseWideGroupAssignmentUpdate(data, assignment.metadata)) {
    throw new AppError(400, "COURSE_WIDE_GROUP_ACTIVITY_LOCKED", "This activity is assigned to all groups from the course.");
  }

  return prisma.courseGroupActivity.update({
    where: { id: assignmentId },
    data: {
      availableFrom: data.availableFrom !== undefined ? parseDateInput(data.availableFrom) : undefined,
      availableUntil: data.availableUntil !== undefined ? parseDateInput(data.availableUntil) : undefined,
      config: data.config as Prisma.InputJsonValue | undefined,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
      position: data.position
    },
    include: {
      activity: {
        include: { activityType: true, bankActivity: true, activityVersion: true }
      }
    }
  });
}

export async function deleteGroupActivityAssignment(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  assignmentId: string
) {
  await assertCanManageCourse(user, courseId);
  await assertGroupBelongsToCourse(courseId, groupId);
  const assignment = await prisma.courseGroupActivity.findFirst({
    where: { id: assignmentId, groupId }
  });
  if (!assignment) {
    throw notFound("Group activity assignment");
  }
  if (isCourseWideGroupAssignment(assignment.metadata)) {
    throw new AppError(400, "COURSE_WIDE_GROUP_ACTIVITY_LOCKED", "This activity is assigned to all groups from the course.");
  }
  await prisma.courseGroupActivity.delete({ where: { id: assignmentId } });
  return { ok: true };
}

async function ensureGradebookItemForAssignment(
  tx: GradebookItemDb,
  input: {
    courseId: string;
    groupId: string;
    groupActivityId: string;
    activityId: string;
    titleSnapshot: string;
    gradebookSettings?: GradebookItemSettingsInput;
  }
) {
  const settings = input.gradebookSettings;
  await tx.gradebookItem.upsert({
    where: { groupActivityId: input.groupActivityId },
    update: settings ? buildGradebookItemSettingsData(settings) : {},
    create: {
      courseId: input.courseId,
      groupId: input.groupId,
      groupActivityId: input.groupActivityId,
      activityId: input.activityId,
      titleSnapshot: input.titleSnapshot,
      ...(settings ? buildGradebookItemSettingsData(settings) : {})
    }
  });
}

async function ensureAssignmentContentItem(
  tx: Pick<typeof prisma, "courseContentItem">,
  input: {
    courseId: string;
    groupId: string;
    groupActivityId: string;
    activityId: string;
    title: string;
    placement: GroupActivityInput["contentPlacement"] | CourseWideContentPlacement;
  }
) {
  if (!input.placement) {
    return;
  }

  const parentId = "parentId" in input.placement ? (input.placement.parentId ?? null) : null;
  if (parentId) {
    const parent = await tx.courseContentItem.findFirst({
      where: { id: parentId, courseId: input.courseId, groupId: null, kind: "folder" },
      select: { id: true }
    });
    if (!parent) {
      throw notFound("Parent folder");
    }
  }

  const position =
    input.placement.position ??
    (await tx.courseContentItem.count({
      where: {
        courseId: input.courseId,
        parentId,
        OR: [{ groupId: null }, { groupId: input.groupId }]
      }
    }));
  const data = {
    courseId: input.courseId,
    groupId: input.groupId,
    parentId,
    kind: "activity" as const,
    titleSnapshot: input.placement.titleSnapshot ?? input.title,
    position,
    isVisible: input.placement.isVisible,
    activityId: input.activityId,
    courseGroupActivityId: input.groupActivityId,
    metadata: input.placement.metadata as Prisma.InputJsonValue
  };

  const existing = await tx.courseContentItem.findFirst({
    where: { courseGroupActivityId: input.groupActivityId, kind: "activity" },
    select: { id: true }
  });
  if (existing) {
    await tx.courseContentItem.update({
      where: { id: existing.id },
      data
    });
    return;
  }

  await tx.courseContentItem.create({ data });
}

async function assertGroupBelongsToCourse(courseId: string, groupId: string) {
  const group = await prisma.courseGroup.findFirst({ where: { id: groupId, courseId } });
  if (!group) {
    throw notFound("Course group");
  }
  return group;
}

async function assertCanViewGroup(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanViewCourse(user, courseId);
  const group = await assertGroupBelongsToCourse(courseId, groupId);

  if (isAdmin(user) || (await canManageCourse(user, courseId))) {
    return group;
  }

  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id }
  });

  if (!participant) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this group.");
  }

  const now = new Date();
  if (
    group.status !== "published" ||
    (group.availableFrom && group.availableFrom > now) ||
    (group.availableUntil && group.availableUntil < now)
  ) {
    throw new AppError(403, "GROUP_NOT_AVAILABLE", "This group is not currently available.");
  }

  return group;
}

async function assertActivityBelongsToCourse(courseId: string, activityId: string) {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId, testItem: null },
    include: { activityType: true }
  });
  if (!activity) {
    throw notFound("Course activity");
  }
  return activity;
}

function assertTestAssignmentIsSummative(
  activity: { activityType?: { key: string } | null } | null | undefined,
  assessmentMode: unknown
) {
  if (activity?.activityType?.key === "test" && assessmentMode !== "summative") {
    throw new AppError(400, "TEST_SUMMATIVE_ONLY", "A Test must be assigned as a summative activity.");
  }
}

function assertSafeExamBrowserIsSummative(assessmentMode: unknown, requireSafeExamBrowser: unknown) {
  if (requireSafeExamBrowser === true && assessmentMode !== "summative") {
    throw new AppError(
      400,
      "SAFE_EXAM_BROWSER_SUMMATIVE_ONLY",
      "Safe Exam Browser can only be required for a summative activity."
    );
  }
}

async function assertTestReadyForCompositeExecution(
  courseId: string,
  activity: { id: string; activityType?: { key: string } | null }
) {
  if (activity.activityType?.key !== "test") return;
  const test = await prisma.test.findFirst({
    where: { courseId, activityId: activity.id },
    select: {
      items: {
        select: {
          activity: {
            select: { title: true, activityType: { select: { key: true } } }
          }
        }
      }
    }
  });
  if (!test?.items.length) {
    throw new AppError(409, "TEST_ITEMS_REQUIRED", "Add at least one activity before assigning this Test.");
  }
  const unsupported = test.items.filter((item) =>
    !getActivityDefinition(item.activity.activityType.key)?.grading?.supportsCompositeExecution
  );
  if (unsupported.length) {
    throw new AppError(
      409,
      "TEST_ITEM_COMPOSITE_UNSUPPORTED",
      "Some Test activities do not support student execution yet.",
      { activityTitles: unsupported.map((item) => item.activity.title) }
    );
  }
}

async function assertCourseMaterialBelongsToCourse(courseId: string, materialId: string) {
  const material = await prisma.courseMaterial.findFirst({ where: { id: materialId, courseId } });
  if (!material) {
    throw notFound("Course material");
  }
  return material;
}

async function assertValidGroupMaterialParent(groupId: string, parentId: string | null | undefined) {
  if (!parentId) {
    return;
  }

  const parent = await prisma.courseGroupMaterial.findFirst({
    where: { id: parentId, groupId, kind: "folder" }
  });
  if (!parent) {
    throw notFound("Parent folder");
  }
}

function parseDateInput(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return new Date(value);
}

function validateAvailability(availableFrom: string | null | undefined, availableUntil: string | null | undefined) {
  if (!availableFrom || !availableUntil) {
    return;
  }

  if (new Date(availableUntil).getTime() < new Date(availableFrom).getTime()) {
    throw new AppError(400, "INVALID_AVAILABILITY_WINDOW", "The availability end must be after the start.");
  }
}

function asMetadataRecord(value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Prisma.JsonValue>;
}

function getCourseWideAssignmentMetadata(value: Prisma.JsonValue | undefined): CourseWideAssignmentMetadata | null {
  const metadata = asMetadataRecord(value);
  const rule = metadata[COURSE_WIDE_ASSIGNMENT_METADATA_KEY];
  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return null;
  }
  return rule as CourseWideAssignmentMetadata;
}

function normalizeGradebookItemSettings(input: unknown) {
  const settings = GradebookItemSettingsInputSchema.parse(input ?? {});
  const gradingMode = settings.gradingMode ?? "points";
  const attemptLimitMode = settings.attemptLimitMode ?? "unlimited";
  const pointsPossible = settings.pointsPossible ?? 100;
  return {
    pointsPossible,
    gradingMode,
    passThresholdPoints: gradingMode === "pass_fail" ? settings.passThresholdPoints ?? pointsPossible / 2 : null,
    passThresholdOutOf: gradingMode === "pass_fail" ? settings.passThresholdOutOf ?? pointsPossible : null,
    attemptLimitMode,
    maxAttempts: attemptLimitMode === "max_attempts" ? settings.maxAttempts ?? 1 : null,
    gradeStrategy: settings.gradeStrategy ?? "latest",
    dropLowestAttempt: settings.dropLowestAttempt ?? false
  };
}

function gradebookSettingsFromItem(item: {
  pointsPossible: number;
  gradingMode: string;
  passThresholdPoints: number | null;
  passThresholdOutOf: number | null;
  attemptLimitMode: string;
  maxAttempts: number | null;
  gradeStrategy: string;
  dropLowestAttempt: boolean;
}) {
  return normalizeGradebookItemSettings({
    pointsPossible: item.pointsPossible,
    gradingMode: item.gradingMode,
    passThresholdPoints: item.passThresholdPoints,
    passThresholdOutOf: item.passThresholdOutOf,
    attemptLimitMode: item.attemptLimitMode,
    maxAttempts: item.maxAttempts,
    gradeStrategy: item.gradeStrategy,
    dropLowestAttempt: item.dropLowestAttempt
  });
}

function readStoredOverrideFields(value: Prisma.JsonValue | undefined): ActivityAssignmentOverrideField[] | null {
  const metadata = asMetadataRecord(value);
  if (!Array.isArray(metadata.overrideFields)) {
    return null;
  }
  const validFields = metadata.overrideFields.filter(
    (field): field is ActivityAssignmentOverrideField =>
      typeof field === "string" && SUMMATIVE_OVERRIDE_FIELDS.has(field as ActivityAssignmentOverrideField)
  );
  return [...new Set(validFields)];
}

function inferLegacyOverrideFields(input: {
  assignment: {
    availableFrom: Date | null;
    availableUntil: Date | null;
    metadata: Prisma.JsonValue;
  };
  assignmentContentPlacement: {
    parentId?: string | null;
    isVisible?: boolean;
  };
  assignmentGradebookSettings: GradebookItemSettingsInput;
  general: {
    availableFrom: string | null;
    availableUntil: string | null;
    requireSafeExamBrowser: boolean;
    gradebookSettings: GradebookItemSettingsInput;
    contentPlacement: {
      parentId?: string | null;
      isVisible?: boolean;
    };
  };
}) {
  const fields: ActivityAssignmentOverrideField[] = [];
  if ((input.assignment.availableFrom?.toISOString() ?? null) !== input.general.availableFrom) fields.push("availableFrom");
  if ((input.assignment.availableUntil?.toISOString() ?? null) !== input.general.availableUntil) fields.push("availableUntil");
  if ((input.assignmentContentPlacement.isVisible ?? true) !== (input.general.contentPlacement.isVisible ?? true)) fields.push("visibility");
  if (assignmentRequiresSafeExamBrowser(input.assignment.metadata) !== input.general.requireSafeExamBrowser) {
    fields.push("requireSafeExamBrowser");
  }
  const groupGradebook = input.assignmentGradebookSettings;
  const generalGradebook = input.general.gradebookSettings;
  if (groupGradebook.pointsPossible !== generalGradebook.pointsPossible) fields.push("pointsPossible");
  if (
    groupGradebook.gradingMode !== generalGradebook.gradingMode ||
    groupGradebook.passThresholdPoints !== generalGradebook.passThresholdPoints ||
    groupGradebook.passThresholdOutOf !== generalGradebook.passThresholdOutOf
  ) fields.push("grading");
  if (
    groupGradebook.attemptLimitMode !== generalGradebook.attemptLimitMode ||
    groupGradebook.maxAttempts !== generalGradebook.maxAttempts
  ) fields.push("attempts");
  if (
    groupGradebook.gradeStrategy !== generalGradebook.gradeStrategy ||
    groupGradebook.dropLowestAttempt !== generalGradebook.dropLowestAttempt
  ) fields.push("gradeStrategy");
  return fields;
}

function mergeGradebookSettings(
  general: GradebookItemSettingsInput,
  group: GradebookItemSettingsInput,
  overrideFields: ActivityAssignmentOverrideField[]
) {
  return {
    pointsPossible: overrideFields.includes("pointsPossible") ? group.pointsPossible : general.pointsPossible,
    gradingMode: overrideFields.includes("grading") ? group.gradingMode : general.gradingMode,
    passThresholdPoints: overrideFields.includes("grading") ? group.passThresholdPoints : general.passThresholdPoints,
    passThresholdOutOf: overrideFields.includes("grading") ? group.passThresholdOutOf : general.passThresholdOutOf,
    attemptLimitMode: overrideFields.includes("attempts") ? group.attemptLimitMode : general.attemptLimitMode,
    maxAttempts: overrideFields.includes("attempts") ? group.maxAttempts : general.maxAttempts,
    gradeStrategy: overrideFields.includes("gradeStrategy") ? group.gradeStrategy : general.gradeStrategy,
    dropLowestAttempt: overrideFields.includes("gradeStrategy") ? group.dropLowestAttempt : general.dropLowestAttempt
  };
}

function buildGradebookItemSettingsData(settings: GradebookItemSettingsInput) {
  return {
    pointsPossible: settings.pointsPossible,
    gradingMode: settings.gradingMode,
    passThresholdPoints: settings.passThresholdPoints,
    passThresholdOutOf: settings.passThresholdOutOf,
    attemptLimitMode: settings.attemptLimitMode,
    maxAttempts: settings.maxAttempts,
    gradeStrategy: settings.gradeStrategy,
    dropLowestAttempt: settings.dropLowestAttempt
  };
}

function buildCourseActivitySettingsMetadata(
  currentValue: Prisma.JsonValue | undefined,
  overrideFields: ActivityAssignmentOverrideField[],
  assessmentMode: "formative" | "summative",
  requireSafeExamBrowser: boolean
): Prisma.InputJsonValue {
  const current = asMetadataRecord(currentValue);
  const {
    assignmentScope: _assignmentScope,
    enablePerGroupSettings: _enablePerGroupSettings,
    overrideFields: _overrideFields,
    assessmentMode: _assessmentMode,
    requireSafeExamBrowser: _requireSafeExamBrowser,
    ...preserved
  } = current;
  return {
    ...preserved,
    assignmentScope: COURSE_ACTIVITY_SETTINGS_SCOPE,
    overrideFields,
    assessmentMode,
    ...(requireSafeExamBrowser ? { requireSafeExamBrowser: true } : {})
  };
}

export function assignmentRequiresSafeExamBrowser(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (value as Record<string, unknown>).requireSafeExamBrowser === true;
}

function isCourseWideGroupAssignment(value: Prisma.JsonValue | undefined) {
  const metadata = asMetadataRecord(value);
  return metadata.assignmentScope === COURSE_WIDE_ASSIGNMENT_SCOPE || metadata.assignmentScope === COURSE_ACTIVITY_SETTINGS_SCOPE;
}

function canEditCourseWideGroupAssignmentSettings(value: Prisma.JsonValue | undefined) {
  const metadata = asMetadataRecord(value);
  if (metadata.assignmentScope === COURSE_ACTIVITY_SETTINGS_SCOPE) {
    const overrideFields = readStoredOverrideFields(value) ?? [];
    return overrideFields.includes("availableFrom") || overrideFields.includes("availableUntil");
  }
  return metadata.enablePerGroupSettings !== false;
}

function removeCourseWideGroupAssignmentMarker(value: Prisma.JsonValue | undefined): Prisma.InputJsonValue {
  const metadata = asMetadataRecord(value);
  const {
    assignmentScope: _removedScope,
    enablePerGroupSettings: _removedSetting,
    overrideFields: _removedOverrides,
    ...nextMetadata
  } = metadata;
  return nextMetadata as Prisma.InputJsonValue;
}

function isAllowedCourseWideGroupAssignmentUpdate(
  data: ReturnType<typeof CourseGroupActivityUpdateSchema.parse>,
  metadata: Prisma.JsonValue | undefined
) {
  if (data.config !== undefined || data.metadata !== undefined) {
    return false;
  }
  if (!canEditCourseWideGroupAssignmentSettings(metadata) && (data.availableFrom !== undefined || data.availableUntil !== undefined)) {
    return false;
  }
  return true;
}

function buildVisibleGroupWhere(): Prisma.CourseGroupWhereInput {
  const now = new Date();
  return {
    status: "published" satisfies CourseGroupStatus,
    AND: [
      {
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }]
      },
      {
        OR: [{ availableUntil: null }, { availableUntil: { gte: now } }]
      }
    ]
  };
}

async function ensureStudentRole(userId: string, tx: StudentAccessDb = prisma) {
  const role = await tx.role.findUnique({ where: { key: "student" } });
  if (!role) {
    throw new AppError(500, "ROLE_NOT_FOUND", "The student role is not configured.");
  }

  await tx.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });
}

async function ensureStudentMembership(userId: string, courseId: string, tx: StudentAccessDb = prisma) {
  await tx.courseMembership.upsert({
    where: {
      courseId_userId_role: {
        courseId,
        userId,
        role: "student"
      }
    },
    update: {},
    create: {
      courseId,
      userId,
      role: "student"
    }
  });
}

async function ensureMembershipsForGroupParticipant(
  userId: string,
  courseId: string,
  role: CourseGroupParticipantRole,
  tx: StudentAccessDb = prisma
) {
  if (role === "student") {
    await ensureStudentRole(userId, tx);
    await ensureStudentMembership(userId, courseId, tx);
    return;
  }

  await tx.courseMembership.upsert({
    where: {
      courseId_userId_role: {
        courseId,
        userId,
        role
      }
    },
    update: {},
    create: {
      courseId,
      userId,
      role
    }
  });
}

function highestParticipantRole(
  current: CourseGroupParticipantRole | undefined,
  next: CourseGroupParticipantRole
): CourseGroupParticipantRole {
  const rank: Record<CourseGroupParticipantRole, number> = {
    teacher: 3,
    ta: 2,
    student: 1
  };
  return !current || rank[next] > rank[current] ? next : current;
}

function firstNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    return "Teacher";
  }
  return trimmed.split(/\s+/)[0] ?? "Teacher";
}

function lastNameFromName(name: string | null) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed.includes(" ")) {
    return "";
  }
  return trimmed.split(/\s+/).slice(1).join(" ");
}
