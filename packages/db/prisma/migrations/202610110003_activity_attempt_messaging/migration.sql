CREATE TYPE "ActivityConversationSenderKind" AS ENUM ('staff', 'student', 'system');

CREATE TABLE "ActivityMessageBroadcast" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "senderUserId" TEXT,
  "senderName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "targetGroupIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityMessageBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityConversation" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "groupActivityId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "attemptId" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityConversationMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "broadcastId" TEXT,
  "senderUserId" TEXT,
  "senderKind" "ActivityConversationSenderKind" NOT NULL,
  "senderName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityConversationRead" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityConversationRead_pkey" PRIMARY KEY ("conversationId", "userId")
);

CREATE UNIQUE INDEX "ActivityConversation_attemptId_key" ON "ActivityConversation"("attemptId");
CREATE UNIQUE INDEX "ActivityConversation_groupActivityId_participantId_attemptNumber_key" ON "ActivityConversation"("groupActivityId", "participantId", "attemptNumber");
CREATE INDEX "ActivityMessageBroadcast_courseId_activityId_createdAt_idx" ON "ActivityMessageBroadcast"("courseId", "activityId", "createdAt");
CREATE INDEX "ActivityMessageBroadcast_senderUserId_idx" ON "ActivityMessageBroadcast"("senderUserId");
CREATE INDEX "ActivityConversation_courseId_activityId_groupId_lastSeenAt_idx" ON "ActivityConversation"("courseId", "activityId", "groupId", "lastSeenAt");
CREATE INDEX "ActivityConversation_participantId_updatedAt_idx" ON "ActivityConversation"("participantId", "updatedAt");
CREATE INDEX "ActivityConversation_closedAt_lastSeenAt_idx" ON "ActivityConversation"("closedAt", "lastSeenAt");
CREATE INDEX "ActivityConversationMessage_conversationId_createdAt_idx" ON "ActivityConversationMessage"("conversationId", "createdAt");
CREATE INDEX "ActivityConversationMessage_broadcastId_idx" ON "ActivityConversationMessage"("broadcastId");
CREATE INDEX "ActivityConversationMessage_senderUserId_idx" ON "ActivityConversationMessage"("senderUserId");
CREATE INDEX "ActivityConversationRead_userId_updatedAt_idx" ON "ActivityConversationRead"("userId", "updatedAt");

ALTER TABLE "ActivityMessageBroadcast" ADD CONSTRAINT "ActivityMessageBroadcast_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityMessageBroadcast" ADD CONSTRAINT "ActivityMessageBroadcast_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityMessageBroadcast" ADD CONSTRAINT "ActivityMessageBroadcast_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityConversation" ADD CONSTRAINT "ActivityConversation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversation" ADD CONSTRAINT "ActivityConversation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CourseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversation" ADD CONSTRAINT "ActivityConversation_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "CourseGroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversation" ADD CONSTRAINT "ActivityConversation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversation" ADD CONSTRAINT "ActivityConversation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CourseGroupParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversation" ADD CONSTRAINT "ActivityConversation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ActivityAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityConversationMessage" ADD CONSTRAINT "ActivityConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ActivityConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversationMessage" ADD CONSTRAINT "ActivityConversationMessage_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "ActivityMessageBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityConversationMessage" ADD CONSTRAINT "ActivityConversationMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityConversationRead" ADD CONSTRAINT "ActivityConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ActivityConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityConversationRead" ADD CONSTRAINT "ActivityConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
