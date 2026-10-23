import { Prisma, prisma } from "@cognelo/db";
import { ActivityBroadcastMessageInputSchema, type CurrentUser } from "@cognelo/contracts";
import { assignmentAttemptExpiresAt, assignmentTimeLimitMinutes, courseActivityMessagingEnabled, courseActivityTwoWayMessagingEnabled } from "./activity-assignment-policy";
import { assertCanGradeGroup, getActivityMessagingGroupScope } from "./authorization";
import { assertActivityContentAccess } from "./activity-content-access";
import { AppError, forbidden, notFound } from "./errors";
import { getActivityAttemptAvailability } from "./gradebook";
import { getGroupAssignedActivity } from "./groups";

export const ACTIVITY_MESSAGING_PRESENCE_WINDOW_MS = 45_000;
const HISTORY_LIMIT = 100;
const conversationIdentity = { id: true, attemptId: true, attemptNumber: true, groupActivityId: true, participantId: true } as const;
type ConversationIdentity = { id: string; attemptId: string | null; attemptNumber: number; groupActivityId: string; participantId: string };

export type ActivityConversationMessageView = {
  id: string; senderKind: "staff" | "student" | "system"; senderName: string;
  body: string; createdAt: string; broadcastId: string | null; attemptNumber: number;
};
export type LearnerActivityMessagingStatus = { id: string; attemptNumber: number; canSend: boolean; unreadCount: number; version: string };
export type ActivityMessagingStatus = { enabled: boolean; version: string };
export type ActivityMessageHistory = { messages: ActivityConversationMessageView[]; hasMore: boolean; unreadCount: number };
export type LearnerActivityConversationView = ActivityMessageHistory & {
  id: string; attemptId: string | null; attemptNumber: number; canSend: boolean;
};
export type ActivityBroadcastView = {
  id: string; senderName: string; body: string; createdAt: string; recipientCount: number; readCount: number;
};
export type ActivityStudentConversationView = {
  participantId: string; studentName: string; groupId: string; groupTitle: string; unread: boolean;
};
export type ActivityMessagingOverview = {
  enabled: boolean; twoWayEnabled: boolean; activeRecipientCount: number; recipientCount: number;
  broadcasts: ActivityBroadcastView[]; hasMoreBroadcasts: boolean; conversations: ActivityStudentConversationView[];
};

export async function getLearnerActivityConversation(
  user: CurrentUser, courseId: string, groupId: string, activityId: string, now = new Date(), before?: string, summaryOnly = false
): Promise<{ conversation: LearnerActivityConversationView | null; messaging?: LearnerActivityMessagingStatus | null }> {
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student" }, select: { id: true }
  });
  if (!participant) throw forbidden();
  const attempts = await prisma.activityAttempt.findMany({
    where: { groupActivityId: activity.assignment.id, participantId: participant.id },
    select: { id: true, attemptNumber: true, lifecycle: true, startedAt: true }, orderBy: { attemptNumber: "desc" }
  });
  const activeAttempt = attempts.find((attempt) => attempt.lifecycle === "started");
  const timeLimit = assignmentTimeLimitMinutes(activity.assignment.metadata);
  const expiresAt = activeAttempt ? assignmentAttemptExpiresAt(activeAttempt.startedAt, timeLimit, activity.assignment.availableUntil) : null;
  const requiresStartedAttempt = activity.activityType.key === "test" || timeLimit !== null;
  if ((!activeAttempt && requiresStartedAttempt) || (expiresAt && expiresAt <= now)
    || (activity.assignment.availableUntil && activity.assignment.availableUntil <= now)) {
    await closeLearnerConversations(activity.assignment.id, participant.id, now);
    return getStoredLearnerActivityConversation(user, courseId, groupId, activityId, before, summaryOnly);
  }
  if (!activeAttempt) {
    const availability = await getActivityAttemptAvailability(user, { courseId, groupId, activityId, now });
    if (!availability.canStart) {
      await closeLearnerConversations(activity.assignment.id, participant.id, now);
      return getStoredLearnerActivityConversation(user, courseId, groupId, activityId, before, summaryOnly);
    }
  }
  const attemptNumber = activeAttempt?.attemptNumber ?? ((attempts[0]?.attemptNumber ?? 0) + 1);
  await prisma.activityConversation.updateMany({
    where: { groupActivityId: activity.assignment.id, participantId: participant.id, attemptNumber: { not: attemptNumber }, closedAt: null },
    data: { closedAt: now }
  });
  const conversation = await prisma.activityConversation.upsert({
    where: { groupActivityId_participantId_attemptNumber: { groupActivityId: activity.assignment.id, participantId: participant.id, attemptNumber } },
    create: { courseId, groupId, groupActivityId: activity.assignment.id, activityId, participantId: participant.id,
      attemptId: activeAttempt?.id ?? null, attemptNumber, lastSeenAt: now },
    update: { attemptId: activeAttempt?.id ?? undefined, lastSeenAt: now, closedAt: null }, select: conversationIdentity
  });
  // Presence exists even with messaging off; it never creates a private-chat tab.
  return courseActivityMessagingEnabled(activity.metadata)
    ? readLearnerConversation(user, conversation, courseActivityTwoWayMessagingEnabled(activity.metadata), before, summaryOnly)
    : { conversation: null };
}

export async function getStoredLearnerActivityConversation(user: CurrentUser, courseId: string, groupId: string, activityId: string, before?: string, summaryOnly = false) {
  // Ordinary availability/SEB changes may retain notices, but content closure always wins.
  await assertActivityContentAccess(user, courseId, groupId, activityId);
  const conversation = await prisma.activityConversation.findFirst({
    where: { courseId, groupId, activityId, participant: { userId: user.id, role: "student" } },
    orderBy: { attemptNumber: "desc" }, select: { ...conversationIdentity, activity: { select: { metadata: true } } }
  });
  if (!conversation || !courseActivityMessagingEnabled(conversation.activity.metadata)) return { conversation: null };
  return readLearnerConversation(user, conversation, false, before, summaryOnly);
}

function participantConversationScope(conversation: ConversationIdentity): Prisma.ActivityConversationWhereInput {
  return { groupActivityId: conversation.groupActivityId, participantId: conversation.participantId };
}

async function readLearnerConversation(user: CurrentUser, conversation: ConversationIdentity, canSend: boolean, before?: string, summaryOnly = false) {
  if (summaryOnly) {
    const scope = participantConversationScope(conversation);
    const [last, conversations] = await Promise.all([
      prisma.activityConversationMessage.findFirst({ where: { conversation: scope }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } }),
      prisma.activityConversation.findMany({ where: scope, select: { id: true, reads: { where: { userId: user.id }, select: { lastReadAt: true } } } })
    ]);
    const unreadCount = conversations.length ? await prisma.activityConversationMessage.count({ where: { AND: [
      { OR: [{ senderUserId: null }, { senderUserId: { not: user.id } }] },
      { OR: conversations.map((entry) => ({ conversationId: entry.id, ...(entry.reads[0] ? { createdAt: { gt: entry.reads[0].lastReadAt } } : {}) })) }
    ] } }) : 0;
    return { conversation: null, messaging: { id: conversation.id, attemptNumber: conversation.attemptNumber, canSend, unreadCount,
      version: `${conversation.id}:${canSend}:${last?.id ?? ""}` } };
  }
  const history = await readMessageHistory(user, participantConversationScope(conversation), before);
  return { conversation: { id: conversation.id, attemptId: conversation.attemptId, attemptNumber: conversation.attemptNumber, canSend, ...history } };
}

async function readMessageHistory(user: CurrentUser, scope: Prisma.ActivityConversationWhereInput, before?: string): Promise<ActivityMessageHistory> {
  const cursor = before ? await prisma.activityConversationMessage.findFirst({
    where: { id: before, conversation: scope }, select: { id: true, createdAt: true }
  }) : null;
  if (before && !cursor) throw notFound("Message");
  const [messages, conversations] = await Promise.all([
    prisma.activityConversationMessage.findMany({
      where: { conversation: scope, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
      select: { id: true, senderKind: true, senderName: true, body: true, createdAt: true, broadcastId: true, conversation: { select: { attemptNumber: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: HISTORY_LIMIT + 1
    }),
    prisma.activityConversation.findMany({ where: scope, select: { id: true, reads: { where: { userId: user.id }, select: { lastReadAt: true } } } })
  ]);
  const unreadCount = conversations.length ? await prisma.activityConversationMessage.count({
    where: { AND: [
      { OR: [{ senderUserId: null }, { senderUserId: { not: user.id } }] },
      { OR: conversations.map((conversation) => ({ conversationId: conversation.id,
        ...(conversation.reads[0] ? { createdAt: { gt: conversation.reads[0].lastReadAt } } : {}) })) }
    ] }
  }) : 0;
  return { unreadCount, hasMore: messages.length > HISTORY_LIMIT,
    messages: messages.slice(0, HISTORY_LIMIT).reverse().map(({ conversation, ...message }) => ({
      ...message, createdAt: message.createdAt.toISOString(), attemptNumber: conversation.attemptNumber
    })) };
}

async function markHistoryRead(user: CurrentUser, scope: Prisma.ActivityConversationWhereInput, now: Date, lastMessageId?: string) {
  const lastMessage = lastMessageId ? await prisma.activityConversationMessage.findFirst({
    where: { id: lastMessageId, conversation: scope }, select: { createdAt: true }
  }) : null;
  if (lastMessageId && !lastMessage) throw notFound("Message");
  const readAt = lastMessage?.createdAt ?? now;
  const conversations = await prisma.activityConversation.findMany({ where: scope, select: { id: true } });
  // An older review or a slower concurrent tab must never move a read cursor back.
  if (conversations.length) await prisma.$transaction([
    prisma.activityConversationRead.createMany({
      data: conversations.map(({ id }) => ({ conversationId: id, userId: user.id, lastReadAt: readAt })), skipDuplicates: true
    }),
    prisma.activityConversationRead.updateMany({
      where: { conversationId: { in: conversations.map(({ id }) => id) }, userId: user.id, lastReadAt: { lt: readAt } },
      data: { lastReadAt: readAt }
    })
  ]);
  return { readAt: readAt.toISOString() };
}

export async function markLearnerActivityConversationRead(user: CurrentUser, courseId: string, groupId: string, activityId: string, conversationId: string, now = new Date(), lastMessageId?: string) {
  await assertActivityContentAccess(user, courseId, groupId, activityId);
  const conversation = await prisma.activityConversation.findFirst({
    where: { id: conversationId, courseId, groupId, activityId, participant: { userId: user.id, role: "student" } },
    select: { ...conversationIdentity, activity: { select: { metadata: true } } }
  });
  if (!conversation) throw notFound("Activity conversation");
  if (!courseActivityMessagingEnabled(conversation.activity.metadata)) throw messagingDisabled();
  return markHistoryRead(user, participantConversationScope(conversation), now, lastMessageId);
}

export async function sendLearnerActivityMessage(user: CurrentUser, courseId: string, groupId: string, activityId: string, body: string) {
  const input = ActivityBroadcastMessageInputSchema.parse({ body });
  await assertActivityContentAccess(user, courseId, groupId, activityId);
  const { conversation } = await getLearnerActivityConversation(user, courseId, groupId, activityId);
  if (!conversation?.canSend) throw new AppError(403, "ACTIVITY_REPLY_DISABLED", "You cannot send messages for this activity right now.");
  await prisma.$transaction(async (tx) => {
    await assertTwoWayEnabled(tx, courseId, activityId);
    await tx.activityConversationMessage.create({ data: { conversationId: conversation.id,
      senderUserId: user.id, senderKind: "student", senderName: displayUserName(user), body: input.body } });
  });
  return { sent: true };
}

// A small revision marker rides on the learner's existing content-access poll.
// It contains no bodies and does not establish a private conversation.
export async function getLearnerActivityMessagingStatus(user: CurrentUser, courseId: string, groupId: string, activityId: string, renewPresence: boolean) {
  const participant = await prisma.courseGroupParticipant.findFirst({ where: { groupId, userId: user.id, role: "student" }, select: { id: true } });
  if (!participant) return null;
  const result = renewPresence
    ? await getLearnerActivityConversation(user, courseId, groupId, activityId, undefined, undefined, true)
    : await getStoredLearnerActivityConversation(user, courseId, groupId, activityId, undefined, true);
  return "messaging" in result ? result.messaging ?? null : null;
}

export async function getActivityMessagingStatus(user: CurrentUser, courseId: string, activityId: string, groupId?: string | null): Promise<ActivityMessagingStatus> {
  const { enabled, twoWayEnabled, groupScope } = await assertActivityMessagingAccess(user, courseId, activityId, groupId);
  const scope = { courseId, activityId, ...(groupScope ? { groupId: { in: groupScope } } : {}) };
  const [last, read] = await Promise.all([
    prisma.activityConversationMessage.findFirst({ where: { conversation: scope }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } }),
    prisma.activityConversationRead.findFirst({ where: { conversation: scope }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })
  ]);
  return { enabled, version: `${enabled}:${twoWayEnabled}:${last?.id ?? ""}:${read?.updatedAt.toISOString() ?? ""}` };
}

export async function getActivityMessagingOverview(user: CurrentUser, courseId: string, activityId: string, groupId?: string | null, now = new Date(), before?: string): Promise<ActivityMessagingOverview> {
  const { groupScope, enabled, twoWayEnabled } = await assertActivityMessagingAccess(user, courseId, activityId, groupId);
  const scope = { courseId, activityId, ...(groupScope ? { groupId: { in: groupScope } } : {}) };
  const broadcastWhere = { courseId, activityId, messages: { some: { conversation: scope } } };
  const cursor = before ? await prisma.activityMessageBroadcast.findFirst({ where: { ...broadcastWhere, id: before } }) : null;
  if (before && !cursor) throw notFound("Broadcast");
  const [active, recipientCount, broadcasts, conversations] = await Promise.all([
    listActiveConversations(courseId, activityId, groupScope, now),
    prisma.courseGroupParticipant.count({ where: { role: "student", group: { courseId, activities: { some: { activityId } } }, ...(groupScope ? { groupId: { in: groupScope } } : {}) } }),
    prisma.activityMessageBroadcast.findMany({
      where: { ...broadcastWhere, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) },
      include: { messages: { where: { conversation: scope }, select: { createdAt: true, conversation: {
        select: { participant: { select: { userId: true } }, reads: { select: { userId: true, lastReadAt: true } } }
      } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: HISTORY_LIMIT + 1
    }),
    prisma.activityConversation.findMany({ where: { ...scope, messages: { some: { senderKind: "student" } } },
      select: { participantId: true, groupId: true, group: { select: { title: true } },
        participant: { select: { firstName: true, lastName: true, email: true } },
        messages: { where: { senderKind: "student" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        reads: { where: { userId: user.id }, select: { lastReadAt: true } } }, orderBy: { updatedAt: "asc" }
    })
  ]);
  const threads = new Map<string, ActivityStudentConversationView>();
  for (const conversation of conversations) {
    const previous = threads.get(conversation.participantId);
    threads.set(conversation.participantId, {
      participantId: conversation.participantId, groupId: conversation.groupId, groupTitle: conversation.group.title,
      studentName: `${conversation.participant.firstName} ${conversation.participant.lastName}`.trim() || conversation.participant.email,
      unread: Boolean(previous?.unread || (conversation.messages[0] && (!conversation.reads[0] || conversation.messages[0].createdAt > conversation.reads[0].lastReadAt)))
    });
  }
  return { enabled, twoWayEnabled, activeRecipientCount: active.length, recipientCount,
    hasMoreBroadcasts: broadcasts.length > HISTORY_LIMIT, conversations: [...threads.values()],
    broadcasts: broadcasts.slice(0, HISTORY_LIMIT).map((broadcast) => ({
      id: broadcast.id, senderName: broadcast.senderName, body: broadcast.body, createdAt: broadcast.createdAt.toISOString(),
      recipientCount: broadcast.messages.length, readCount: broadcast.messages.filter((message) => {
        const userId = message.conversation.participant.userId;
        return userId && message.conversation.reads.some((read) => read.userId === userId && read.lastReadAt >= message.createdAt);
      }).length
    })) };
}

export async function sendActivityBroadcast(user: CurrentUser, courseId: string, activityId: string, body: string, groupId?: string | null, now = new Date()) {
  body = ActivityBroadcastMessageInputSchema.parse({ body }).body;
  const { groupScope, enabled } = await assertActivityMessagingAccess(user, courseId, activityId, groupId);
  if (!enabled) throw messagingDisabled();
  const senderName = displayUserName(user);
  return prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findFirst({ where: { id: activityId, courseId }, select: { metadata: true } });
    if (!courseActivityMessagingEnabled(activity?.metadata)) throw messagingDisabled();
    const assignments = await tx.courseGroupActivity.findMany({
      where: { activityId, group: { courseId }, ...(groupScope ? { groupId: { in: groupScope } } : {}) },
      select: { id: true, groupId: true, group: { select: { participants: { where: { role: "student" }, select: { id: true } } } } }
    });
    const attempts = await tx.activityAttempt.findMany({ where: { groupActivityId: { in: assignments.map((assignment) => assignment.id) } },
      select: { id: true, groupActivityId: true, participantId: true, attemptNumber: true }, orderBy: { attemptNumber: "desc" } });
    const existing = await tx.activityConversation.findMany({ where: { groupActivityId: { in: assignments.map((assignment) => assignment.id) } },
      select: { id: true, groupActivityId: true, participantId: true, attemptNumber: true }, orderBy: { attemptNumber: "desc" } });
    const latestConversation = new Map<string, typeof existing[number]>();
    for (const conversation of existing) {
      const key = `${conversation.groupActivityId}:${conversation.participantId}`;
      if (!latestConversation.has(key)) latestConversation.set(key, conversation);
    }
    const latest = new Map<string, typeof attempts[number]>();
    for (const attempt of attempts) {
      const key = `${attempt.groupActivityId}:${attempt.participantId}`;
      if (!latest.has(key)) latest.set(key, attempt);
    }
    const recipients: string[] = [];
    for (const assignment of assignments) for (const participant of assignment.group.participants) {
      const attempt = latest.get(`${assignment.id}:${participant.id}`);
      const current = latestConversation.get(`${assignment.id}:${participant.id}`);
      const attemptNumber = Math.max(attempt?.attemptNumber ?? 1, current?.attemptNumber ?? 1);
      const conversation = await tx.activityConversation.upsert({
        where: { groupActivityId_participantId_attemptNumber: { groupActivityId: assignment.id, participantId: participant.id, attemptNumber } },
        create: { courseId, activityId, groupId: assignment.groupId, groupActivityId: assignment.id, participantId: participant.id,
          attemptNumber, attemptId: attempt?.attemptNumber === attemptNumber ? attempt.id : undefined, lastSeenAt: new Date(0), closedAt: now },
        update: {}, select: { id: true }
      });
      recipients.push(conversation.id);
    }
    if (!recipients.length) throw new AppError(409, "NO_ACTIVITY_RECIPIENTS", "No students are enrolled in the assigned sections.");
    const broadcast = await tx.activityMessageBroadcast.create({ data: {
      courseId, activityId, senderUserId: user.id, senderName, body, targetGroupIds: assignments.map((assignment) => assignment.groupId), createdAt: now
    } });
    await tx.activityConversationMessage.createMany({ data: recipients.map((conversationId) => ({
      conversationId, broadcastId: broadcast.id, senderUserId: user.id, senderKind: "staff" as const, senderName, body, createdAt: now
    })) });
    return { broadcast: { id: broadcast.id, senderName, body, createdAt: now.toISOString(), recipientCount: recipients.length, readCount: 0 } satisfies ActivityBroadcastView };
  }, { timeout: 30_000 });
}

async function staffConversationScope(user: CurrentUser, courseId: string, activityId: string, participantId: string, attemptId?: string) {
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { id: participantId, role: "student", group: { courseId, activities: { some: { activityId } } } },
    select: { groupId: true, firstName: true, lastName: true, email: true }
  });
  if (!participant) throw notFound("Student");
  await assertCanGradeGroup(user, courseId, participant.groupId);
  const scope: Prisma.ActivityConversationWhereInput = { courseId, activityId, participantId, groupId: participant.groupId };
  if (attemptId) {
    const attempt = await prisma.activityAttempt.findFirst({ where: { id: attemptId, courseId, activityId, participantId, groupId: participant.groupId }, select: { attemptNumber: true } });
    if (!attempt) throw notFound("Attempt");
    scope.attemptNumber = attempt.attemptNumber;
  }
  return { scope, participant };
}

export async function getStaffActivityConversation(user: CurrentUser, courseId: string, activityId: string, participantId: string, options: { before?: string; attemptId?: string } = {}) {
  const { scope, participant } = await staffConversationScope(user, courseId, activityId, participantId, options.attemptId);
  const [history, activity] = await Promise.all([
    readMessageHistory(user, scope, options.before), prisma.activity.findFirst({ where: { id: activityId, courseId }, select: { metadata: true } })
  ]);
  // Reviewers (including TAs) may read retained discussions; sending needs teacher scope.
  let canSend = false;
  if (courseActivityMessagingEnabled(activity?.metadata) && courseActivityTwoWayMessagingEnabled(activity?.metadata)) {
    try {
      await getActivityMessagingGroupScope(user, courseId, participant.groupId);
      canSend = Boolean(await prisma.activityConversationMessage.findFirst({ where: { conversation: scope, senderKind: "student" }, select: { id: true } }));
    } catch (error) { if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error; }
  }
  return { conversation: { ...history, canSend, studentName: `${participant.firstName} ${participant.lastName}`.trim() || participant.email } };
}

export async function markStaffActivityConversationRead(user: CurrentUser, courseId: string, activityId: string, participantId: string, lastMessageId: string, attemptId?: string) {
  const { scope } = await staffConversationScope(user, courseId, activityId, participantId, attemptId);
  return markHistoryRead(user, scope, new Date(), lastMessageId);
}

export async function sendStaffActivityReply(user: CurrentUser, courseId: string, activityId: string, participantId: string, body: string) {
  body = ActivityBroadcastMessageInputSchema.parse({ body }).body;
  const { scope, participant } = await staffConversationScope(user, courseId, activityId, participantId);
  await getActivityMessagingGroupScope(user, courseId, participant.groupId);
  return prisma.$transaction(async (tx) => {
    await assertTwoWayEnabled(tx, courseId, activityId);
    const conversation = await tx.activityConversation.findFirst({ where: { ...scope, messages: { some: { senderKind: "student" } } }, orderBy: { attemptNumber: "desc" }, select: { id: true } });
    if (!conversation) throw new AppError(409, "ACTIVITY_CONVERSATION_NOT_STARTED", "The student must send a message before you can reply.");
    await tx.activityConversationMessage.create({ data: { conversationId: conversation.id, senderUserId: user.id, senderKind: "staff", senderName: displayUserName(user), body } });
    return { sent: true };
  });
}

async function assertTwoWayEnabled(tx: Prisma.TransactionClient, courseId: string, activityId: string) {
  const activity = await tx.activity.findFirst({ where: { id: activityId, courseId }, select: { metadata: true } });
  if (!courseActivityMessagingEnabled(activity?.metadata)) throw messagingDisabled();
  if (!courseActivityTwoWayMessagingEnabled(activity?.metadata)) throw new AppError(403, "ACTIVITY_REPLY_DISABLED", "Two-way messaging is disabled for this activity.");
}
async function assertActivityMessagingAccess(user: CurrentUser, courseId: string, activityId: string, groupId?: string | null) {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId }, select: { id: true, metadata: true } });
  if (!activity) throw notFound("Activity");
  const groupScope = await getActivityMessagingGroupScope(user, courseId, groupId);
  if (groupId && !await prisma.courseGroupActivity.findFirst({ where: { activityId, groupId, group: { courseId } }, select: { id: true } })) throw notFound("Group activity assignment");
  return { groupScope, enabled: courseActivityMessagingEnabled(activity.metadata), twoWayEnabled: courseActivityTwoWayMessagingEnabled(activity.metadata) };
}
function messagingDisabled() { return new AppError(403, "ACTIVITY_MESSAGING_DISABLED", "Messaging is disabled for this activity."); }
function displayUserName(user: CurrentUser) { return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name?.trim() || user.email; }

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
