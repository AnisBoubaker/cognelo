import type { CurrentUser } from "@cognelo/contracts";
import type { Prisma } from "@cognelo/db";
import { listActiveConversations } from "./activity-messaging";
import { AppError, forbidden } from "./errors";
import { getActivityMessagingGroupScope } from "./authorization";
import { courseActivityMessagingEnabled } from "./activity-assignment-policy";

/** Called inside the settings transaction, after authorization and before writes. */
export async function confirmLiveActivitySettings(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  courseId: string,
  activityId: string,
  input: { confirmActiveStudents?: boolean; studentMessage?: string; messagingEnabled?: boolean },
  groupIds: string[] | null = null
) {
  const now = new Date();
  const conversations = await listActiveConversations(courseId, activityId, groupIds, now, tx);
  let canNotifyStudents = false;
  if (conversations.length) {
    // Use the setting being saved, so enabling can include a notice and disabling
    // cannot silently deliver a message that learners are no longer able to read.
    const enabled = input.messagingEnabled ?? courseActivityMessagingEnabled((await tx.activity.findFirst({
      where: { id: activityId, courseId }, select: { metadata: true }
    }))?.metadata);
    if (enabled) {
      try {
        const messageScope = await getActivityMessagingGroupScope(user, courseId);
        canNotifyStudents = !messageScope || conversations.every((conversation) => messageScope.includes(conversation.groupId));
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "FORBIDDEN") throw error;
      }
    }
  }
  if (conversations.length && !input.confirmActiveStudents) {
    throw new AppError(409, "ACTIVITY_SETTINGS_ACTIVE_STUDENTS", "Students are currently answering this activity. Confirm before applying live settings.", {
      activeStudentCount: conversations.length, canNotifyStudents
    });
  }
  const body = input.studentMessage?.trim();
  if (!body || !conversations.length) return;
  if (!canNotifyStudents) throw forbidden();
  const senderName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;
  const broadcast = await tx.activityMessageBroadcast.create({
    data: { courseId, activityId, senderUserId: user.id, senderName, body,
      targetGroupIds: [...new Set(conversations.map((conversation) => conversation.groupId))], createdAt: now }
  });
  await tx.activityConversationMessage.createMany({
    data: conversations.map((conversation) => ({
      conversationId: conversation.id, broadcastId: broadcast.id, senderUserId: user.id,
      senderKind: "staff" as const, senderName, body, createdAt: now
    }))
  });
}
