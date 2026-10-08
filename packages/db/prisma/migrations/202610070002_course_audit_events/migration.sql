CREATE TABLE "CourseAuditEvent" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "previousValue" JSONB,
  "nextValue" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseAuditEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CourseAuditEvent"
  ADD CONSTRAINT "CourseAuditEvent_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseAuditEvent"
  ADD CONSTRAINT "CourseAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CourseAuditEvent_courseId_createdAt_idx" ON "CourseAuditEvent"("courseId", "createdAt");
CREATE INDEX "CourseAuditEvent_actorUserId_idx" ON "CourseAuditEvent"("actorUserId");
CREATE INDEX "CourseAuditEvent_eventType_createdAt_idx" ON "CourseAuditEvent"("eventType", "createdAt");
CREATE INDEX "CourseAuditEvent_targetType_targetId_idx" ON "CourseAuditEvent"("targetType", "targetId");
