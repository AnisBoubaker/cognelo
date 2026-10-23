BEGIN;

ALTER TABLE "ActivityMessageBroadcast" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ActivityConversationMessage" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "ActivityMessageBroadcast_courseId_activityId_deletedAt_idx"
  ON "ActivityMessageBroadcast"("courseId", "activityId", "deletedAt");
CREATE INDEX "ActivityConversationMessage_conversationId_deletedAt_idx"
  ON "ActivityConversationMessage"("conversationId", "deletedAt");

COMMIT;
