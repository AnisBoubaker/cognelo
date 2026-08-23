import { z } from "zod";
import type { CurrentUser } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError } from "./errors";
import { getGroupAssignedActivity } from "./groups";

const MAX_ACTIVITY_RESPONSE_DRAFT_BYTES = 2 * 1024 * 1024;

const activityResponseDraftStateSchema = z.record(z.unknown());

export async function getActivityResponseDraft(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const context = await resolveActivityResponseDraftContext(user, courseId, groupId, activityId);
  return prisma.activityResponseDraft.findUnique({
    where: {
      groupActivityId_participantId: {
        groupActivityId: context.groupActivityId,
        participantId: context.participantId
      }
    },
    select: { id: true, state: true, createdAt: true, updatedAt: true }
  });
}

export async function saveActivityResponseDraft(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string,
  state: unknown
) {
  const parsedState = activityResponseDraftStateSchema.parse(state);
  assertDraftSize(parsedState);
  const context = await resolveActivityResponseDraftContext(user, courseId, groupId, activityId);
  return prisma.activityResponseDraft.upsert({
    where: {
      groupActivityId_participantId: {
        groupActivityId: context.groupActivityId,
        participantId: context.participantId
      }
    },
    create: {
      groupActivityId: context.groupActivityId,
      participantId: context.participantId,
      state: parsedState as Prisma.InputJsonValue
    },
    update: {
      state: parsedState as Prisma.InputJsonValue
    },
    select: { id: true, state: true, createdAt: true, updatedAt: true }
  });
}

export async function clearActivityResponseDraft(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const context = await resolveActivityResponseDraftContext(user, courseId, groupId, activityId);
  await prisma.activityResponseDraft.deleteMany({
    where: {
      groupActivityId: context.groupActivityId,
      participantId: context.participantId
    }
  });
  return { ok: true as const };
}

async function resolveActivityResponseDraftContext(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  if (activity.activityType.key === "test") {
    throw new AppError(
      400,
      "TEST_ACTIVITY_DRAFT_UNSUPPORTED",
      "Test activities persist child state through the Test attempt runtime."
    );
  }

  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" },
    select: { id: true }
  });
  if (!participant) {
    throw new AppError(403, "PARTICIPANT_REQUIRED", "Only enrolled students can save activity responses.");
  }

  return {
    groupActivityId: activity.assignment.id,
    participantId: participant.id
  };
}

function assertDraftSize(state: Record<string, unknown>) {
  const byteLength = Buffer.byteLength(JSON.stringify(state), "utf8");
  if (byteLength > MAX_ACTIVITY_RESPONSE_DRAFT_BYTES) {
    throw new AppError(
      413,
      "ACTIVITY_RESPONSE_DRAFT_TOO_LARGE",
      "The saved activity response is too large."
    );
  }
}
