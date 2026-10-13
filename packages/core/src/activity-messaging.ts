import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { assignmentTimeLimitMinutes, courseActivityMessagingEnabled } from "./activity-assignment-policy";
import { getActivityMessagingGroupScope } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";
import { getActivityAttemptAvailability } from "./gradebook";
import { getGroupAssignedActivity } from "./groups";

export const ACTIVITY_MESSAGING_PRESENCE_WINDOW_MS = 45_000;
const ACTIVITY_MESSAGE_HISTORY_LIMIT = 100;
const ACTIVITY_BROADCAST_HISTORY_LIMIT = 50;

export type ActivityConversationMessageView = {
  id: string;
  senderKind: "staff" | "student" | "system";
  senderName: string;
  body: string;
  createdAt: string;
};

export type LearnerActivityConversationView = {
  id: string;
  attemptId: string | null;
  attemptNumber: number;
  unreadCount: number;
  messages: ActivityConversationMessageView[];
};

export type ActivityBroadcastView = {
  id: string;
  senderName: string;
  body: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
};

export type ActivityMessagingOverview = {
  enabled: boolean;
  activeRecipientCount: number;
  broadcasts: ActivityBroadcastView[];
};

export async function getLearnerActivityConversation(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string,
  now = new Date()
): Promise<{ conversation: LearnerActivityConversationView | null }> {
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" },
    select: { id: true }
  });
  if (!participant) throw forbidden();

  const attempts = await prisma.activityAttempt.findMany({
    where: {
      groupActivityId: activity.assignment.id,
      participantId: participant.id
    },
    select: { id: true, attemptNumber: true, lifecycle: true },
    orderBy: [{ attemptNumber: "desc" }]
  });
  const activeAttempt = attempts.find((attempt) => attempt.lifecycle === "started") ?? null;
  const requiresStartedCoreAttempt = activity.activityType.key === "test"
    || assignmentTimeLimitMinutes(activity.assignment.metadata) !== null;

  if (!activeAttempt && requiresStartedCoreAttempt) {
    await closeLearnerConversations(activity.assignment.id, participant.id, now);
    return { conversation: null };
  }

  if (!activeAttempt) {
    const availability = await getActivityAttemptAvailability(user, { courseId, groupId, activityId, now });
    if (!availability.canStart) {
      await closeLearnerConversations(activity.assignment.id, participant.id, now);
      return getStoredLearnerActivityConversation(user, courseId, groupId, activityId);
    }
  }

  const attemptNumber = activeAttempt?.attemptNumber ?? ((attempts[0]?.attemptNumber ?? 0) + 1);
  await prisma.activityConversation.updateMany({
    where: {
      groupActivityId: activity.assignment.id,
      participantId: participant.id,
      attemptNumber: { not: attemptNumber },
      closedAt: null
    },
    data: { closedAt: now }
  });
  const conversation = await prisma.activityConversation.upsert({
    where: {
      groupActivityId_participantId_attemptNumber: {
        groupActivityId: activity.assignment.id,
        participantId: participant.id,
        attemptNumber
      }
    },
    create: {
      courseId,
      groupId,
      groupActivityId: activity.assignment.id,
      activityId,
      participantId: participant.id,
      attemptId: activeAttempt?.id ?? null,
      attemptNumber,
      lastSeenAt: now
    },
    update: {
      attemptId: activeAttempt?.id ?? undefined,
      lastSeenAt: now,
      closedAt: null
    },
    select: { id: true, attemptId: true, attemptNumber: true }
  });

  // Keep presence for live-settings warnings while messaging is disabled. Polling
  // continues without revealing messages, so enabling works during an attempt.
  return courseActivityMessagingEnabled(activity.metadata)
    ? readConversation(user, conversation)
    : { conversation: null };
}

// Notices remain readable if a live policy change closes access to the activity.
// This path never opens a conversation or renews answering presence.
export async function getStoredLearnerActivityConversation(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const conversation = await prisma.activityConversation.findFirst({
    where: { courseId, groupId, activityId, participant: { userId: user.id, role: "student" } },
    orderBy: [{ attemptNumber: "desc" }],
    select: { id: true, attemptId: true, attemptNumber: true, activity: { select: { metadata: true } } }
  });
  if (!conversation || !courseActivityMessagingEnabled(conversation.activity.metadata)) return { conversation: null };
  return readConversation(user, { id: conversation.id, attemptId: conversation.attemptId, attemptNumber: conversation.attemptNumber });
}

async function readConversation(user: CurrentUser, conversation: { id: string; attemptId: string | null; attemptNumber: number }) {
  const [messagesDescending, readState] = await Promise.all([
    prisma.activityConversationMessage.findMany({
      where: { conversationId: conversation.id },
      select: { id: true, senderKind: true, senderName: true, body: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ACTIVITY_MESSAGE_HISTORY_LIMIT
    }),
    prisma.activityConversationRead.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: user.id } },
      select: { lastReadAt: true }
    })
  ]);
  const messages = messagesDescending.reverse();
  const unreadCount = await prisma.activityConversationMessage.count({
    where: {
      conversationId: conversation.id,
      OR: [
        { senderUserId: null },
        { senderUserId: { not: user.id } }
      ],
      ...(readState ? { createdAt: { gt: readState.lastReadAt } } : {})
    }
  });

  return {
    conversation: {
      ...conversation,
      unreadCount,
      messages: messages.map(toMessageView)
    }
  };
}

export async function markLearnerActivityConversationRead(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string,
  conversationId: string,
  now = new Date()
) {
  const conversation = await prisma.activityConversation.findFirst({
    where: {
      id: conversationId,
      courseId,
      groupId,
      activityId,
      participant: { userId: user.id, role: "student" }
    },
    select: { id: true, activity: { select: { metadata: true } } }
  });
  if (!conversation) throw notFound("Activity conversation");
  if (!courseActivityMessagingEnabled(conversation.activity.metadata)) throw messagingDisabled();
  await prisma.activityConversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    create: { conversationId, userId: user.id, lastReadAt: now },
    update: { lastReadAt: now }
  });
  return { readAt: now.toISOString() };
}

export async function getActivityMessagingOverview(
  user: CurrentUser,
  courseId: string,
  activityId: string,
  groupId?: string | null,
  now = new Date()
): Promise<ActivityMessagingOverview> {
  const { groupScope, enabled } = await assertActivityMessagingAccess(user, courseId, activityId, groupId);
  const activeConversations = await listActiveConversations(courseId, activityId, groupScope, now);
  const conversationWhere = {
    courseId,
    activityId,
    ...(groupScope ? { groupId: { in: groupScope } } : {})
  } as const;
  const broadcasts = await prisma.activityMessageBroadcast.findMany({
    where: {
      courseId,
      activityId,
      messages: { some: { conversation: conversationWhere } }
    },
    include: {
      messages: {
        where: { conversation: conversationWhere },
        select: {
          createdAt: true,
          conversation: {
            select: {
              participant: { select: { userId: true } },
              reads: { select: { userId: true, lastReadAt: true } }
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ACTIVITY_BROADCAST_HISTORY_LIMIT
  });

  return {
    enabled,
    activeRecipientCount: activeConversations.length,
    broadcasts: broadcasts.map((broadcast) => ({
      id: broadcast.id,
      senderName: broadcast.senderName,
      body: broadcast.body,
      createdAt: broadcast.createdAt.toISOString(),
      recipientCount: broadcast.messages.length,
      readCount: broadcast.messages.filter((message) => {
        const learnerUserId = message.conversation.participant.userId;
        return Boolean(learnerUserId && message.conversation.reads.some(
          (read) => read.userId === learnerUserId && read.lastReadAt >= message.createdAt
        ));
      }).length
    }))
  };
}

export async function sendActivityBroadcast(
  user: CurrentUser,
  courseId: string,
  activityId: string,
  body: string,
  groupId?: string | null,
  now = new Date()
) {
  const { groupScope, enabled } = await assertActivityMessagingAccess(user, courseId, activityId, groupId);
  if (!enabled) throw messagingDisabled();
  const activeConversations = await listActiveConversations(courseId, activityId, groupScope, now);
  if (!activeConversations.length) {
    throw new AppError(409, "NO_ACTIVE_ACTIVITY_ATTEMPTS", "No learners are currently active in this activity.");
  }
  const senderName = displayUserName(user);
  const targetGroupIds = [...new Set(activeConversations.map((conversation) => conversation.groupId))].sort();
  const broadcast = await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findFirst({ where: { id: activityId, courseId }, select: { metadata: true } });
    if (!courseActivityMessagingEnabled(activity?.metadata)) throw messagingDisabled();
    const created = await tx.activityMessageBroadcast.create({
      data: {
        courseId,
        activityId,
        senderUserId: user.id,
        senderName,
        body,
        targetGroupIds: targetGroupIds as Prisma.InputJsonValue,
        createdAt: now
      }
    });
    await tx.activityConversationMessage.createMany({
      data: activeConversations.map((conversation) => ({
        conversationId: conversation.id,
        broadcastId: created.id,
        senderUserId: user.id,
        senderKind: "staff" as const,
        senderName,
        body,
        createdAt: now
      }))
    });
    return created;
  });
  return {
    broadcast: {
      id: broadcast.id,
      senderName,
      body,
      createdAt: now.toISOString(),
      recipientCount: activeConversations.length,
      readCount: 0
    } satisfies ActivityBroadcastView
  };
}

async function assertActivityMessagingAccess(
  user: CurrentUser,
  courseId: string,
  activityId: string,
  groupId?: string | null
) {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, courseId },
    select: { id: true, metadata: true }
  });
  if (!activity) throw notFound("Activity");
  const groupScope = await getActivityMessagingGroupScope(user, courseId, groupId);
  if (groupId) {
    const assignment = await prisma.courseGroupActivity.findFirst({
      where: { activityId, groupId, group: { courseId } },
      select: { id: true }
    });
    if (!assignment) throw notFound("Group activity assignment");
  }
  return { groupScope, enabled: courseActivityMessagingEnabled(activity.metadata) };
}

function messagingDisabled() {
  return new AppError(403, "ACTIVITY_MESSAGING_DISABLED", "Messaging is disabled for this activity.");
}

export async function listActiveConversations(
  courseId: string,
  activityId: string,
  groupScope: string[] | null,
  now: Date,
  db: Pick<Prisma.TransactionClient, "activityConversation" | "activityAttempt"> = prisma
) {
  const conversations = await db.activityConversation.findMany({
    where: {
      courseId,
      activityId,
      closedAt: null,
      lastSeenAt: { gte: new Date(now.getTime() - ACTIVITY_MESSAGING_PRESENCE_WINDOW_MS) },
      participant: { role: "student", userId: { not: null } },
      ...(groupScope ? { groupId: { in: groupScope } } : {})
    },
    select: {
      id: true,
      groupId: true,
      groupActivityId: true,
      participantId: true,
      attemptNumber: true,
      lastSeenAt: true,
      attempt: { select: { lifecycle: true } }
    },
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }]
  });
  if (!conversations.length) return [];

  const recordedAttempts = await db.activityAttempt.findMany({
    where: {
      groupActivityId: { in: [...new Set(conversations.map((conversation) => conversation.groupActivityId))] },
      participantId: { in: [...new Set(conversations.map((conversation) => conversation.participantId))] },
      attemptNumber: { in: [...new Set(conversations.map((conversation) => conversation.attemptNumber))] }
    },
    select: { groupActivityId: true, participantId: true, attemptNumber: true, lifecycle: true }
  });
  const lifecycleByAttempt = new Map(recordedAttempts.map((attempt) => [
    conversationAttemptKey(attempt),
    attempt.lifecycle
  ]));
  const seenParticipants = new Set<string>();
  return conversations.filter((conversation) => {
    const lifecycle = conversation.attempt?.lifecycle ?? lifecycleByAttempt.get(conversationAttemptKey(conversation));
    if (lifecycle && lifecycle !== "started") return false;
    const participantKey = `${conversation.groupId}:${conversation.participantId}`;
    if (seenParticipants.has(participantKey)) return false;
    seenParticipants.add(participantKey);
    return true;
  });
}

async function closeLearnerConversations(groupActivityId: string, participantId: string, now: Date) {
  await prisma.activityConversation.updateMany({
    where: { groupActivityId, participantId, closedAt: null },
    data: { closedAt: now }
  });
}

function conversationAttemptKey(value: { groupActivityId: string; participantId: string; attemptNumber: number }) {
  return `${value.groupActivityId}:${value.participantId}:${value.attemptNumber}`;
}

function toMessageView(message: {
  id: string;
  senderKind: "staff" | "student" | "system";
  senderName: string;
  body: string;
  createdAt: Date;
}): ActivityConversationMessageView {
  return { ...message, createdAt: message.createdAt.toISOString() };
}

function displayUserName(user: CurrentUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name?.trim() || user.email;
}
