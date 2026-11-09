import { homeworkFileStageSettings } from "./stage-scheduling";
import { AppError, activityTeamworkEnabled, assertCanGradeGroup, assertCanManageCourse } from "@cognelo/core";
import { prisma as coreDb } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "./db-client";
import { handInHomework } from "./hand-in";
import { record, type HomeworkStudentScope } from "./file-preparation";
import type { HomeworkTeacherScope } from "./workflow-settings";

type Candidate = { id: string; groupId: string; userId: string; revision: number; preparationStartedAt: Date | null };
export type AutomaticHomeworkIssue = { student: string; code: string; message: string };
const benign = new Set(["HOMEWORK_AUTOMATIC_NOT_DUE", "HOMEWORK_AUTOMATIC_CANCELLED", "HOMEWORK_AUTOMATIC_EMPTY", "HOMEWORK_FILES_FROZEN", "HOMEWORK_MEMBERSHIP_CHANGED", "HOMEWORK_TEAM_MODE_CHANGED", "HOMEWORK_TEAM_REQUIRED", "HOMEWORK_DRAFT_CONFLICT", "ACTIVITY_TEAM_ENROLLMENT_REQUIRED"]);
/** Called only after the learner page or staff activity route has authorized its scope. */
async function recover(scope: HomeworkTeacherScope, groupId?: string, studentId?: string): Promise<AutomaticHomeworkIssue[]> {
  const [assignment, activity] = await Promise.all([
    prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId }, select: { settings: true } }),
    coreDb.activity.findFirst({ where: { id: scope.activityId, courseId: scope.courseId, activityType: { key: "coding-homework-grader" } }, select: { metadata: true } })
  ]);
  const settings = record(assignment?.settings);
  if (!activity || settings.submissionsEnabled !== true) return [];
  const team = activityTeamworkEnabled(activity.metadata);
  // Candidate lists contain identities/revisions only; read each bounded file collection inside its hand-in transaction.
  const candidates = team ? await coreDb.$queryRaw<Candidate[]>`SELECT w.id,w."groupId",w.revision,w."preparationStartedAt",member."userId"
    FROM "PluginCodingHomeworkWorkspace" w JOIN "CourseGroupActivity" ga ON ga."groupId"=w."groupId" AND ga."activityId"=w."activityId"
    JOIN "CourseGroup" g ON g.id=w."groupId" AND g."courseId"=${scope.courseId}
    CROSS JOIN LATERAL (SELECT p."userId" FROM "CourseGroupParticipant" p JOIN "User" u ON u.id=p."userId" AND u."isActive"=TRUE
      WHERE p."groupId"=w."groupId" AND p.role='student' AND (${studentId ?? null}::text IS NULL OR p."userId"=${studentId ?? null})
      AND ((w."teamId" IS NULL AND p.id=w."ownerParticipantId" AND ga.metadata->'teamwork'->>'allowIndividualSubmission'='true') OR EXISTS(
        SELECT 1 FROM "StudentTeamMember" m WHERE m."participantId"=p.id AND m."groupingId"=w."groupingId" AND m."teamId"=w."teamId"))
      ORDER BY p.id LIMIT 1) member
    WHERE w."activityId"=${scope.activityId} AND w."groupingId"=ga.metadata->'teamwork'->>'groupingId'
      AND (${groupId ?? null}::text IS NULL OR w."groupId"=${groupId ?? null}) AND w."currentSubmissionId" IS NULL AND jsonb_array_length(w.files)>0 ORDER BY w.id`
    : await coreDb.$queryRaw<Candidate[]>`SELECT d.id,d."groupId",d."userId",d.revision,d."preparationStartedAt" FROM "PluginCodingHomeworkDraft" d
      JOIN "CourseGroupActivity" ga ON ga."activityId"=d."activityId" AND ga."groupId"=d."groupId"
      JOIN "CourseGroup" g ON g.id=d."groupId" AND g."courseId"=${scope.courseId}
      JOIN "CourseGroupParticipant" p ON p."groupId"=d."groupId" AND p."userId"=d."userId" AND p.role='student'
      JOIN "User" u ON u.id=d."userId" AND u."isActive"=TRUE
      WHERE d."activityId"=${scope.activityId} AND (${groupId ?? null}::text IS NULL OR d."groupId"=${groupId ?? null})
        AND (${studentId ?? null}::text IS NULL OR d."userId"=${studentId ?? null}) AND jsonb_array_length(d.files)>0
        AND NOT EXISTS(SELECT 1 FROM "PluginCodingHomeworkSubmission" s WHERE s."activityId"=d."activityId" AND s."groupId"=d."groupId" AND s."userId"=d."userId" AND s.kind='final' AND s.status NOT IN ('cancelled','invalid_structure') AND NOT s.metadata ? 'deletion') ORDER BY d.id`;
  if (!candidates.length) return [];
  const users = await coreDb.user.findMany({ where: { id: { in: [...new Set(candidates.map(candidate => candidate.userId))] } }, select: { id: true, email: true, name: true, firstName: true, lastName: true, roles: { select: { role: { select: { key: true } } } } } });
  const issues: AutomaticHomeworkIssue[] = [];
  for (const candidate of candidates) {
    const stored = users.find(user => user.id === candidate.userId); if (!stored) continue;
    const user: CurrentUser = { ...stored, roles: stored.roles.map(value => value.role.key) as CurrentUser["roles"] };
    try {
      const stage = await homeworkFileStageSettings({ user, courseId: scope.courseId, activityId: scope.activityId, groupId: candidate.groupId }, candidate.preparationStartedAt);
      if (!stage.submissionClosesAt || Date.parse(stage.submissionClosesAt) > Date.now()) continue;
      await handInHomework({ user, courseId: scope.courseId, activityId: scope.activityId, groupId: candidate.groupId }, { expectedRevision: candidate.revision, acknowledgeIncomplete: true },
        { cutoff: stage.submissionClosesAt, triggeredBy: scope.user.id, ...(team ? { workspaceId: candidate.id } : {}) });
    } catch (error) {
      if (error instanceof AppError && benign.has(error.code)) continue;
      issues.push({ student: stored.name || [stored.firstName, stored.lastName].filter(Boolean).join(" ") || stored.email,
        code: error instanceof AppError ? error.code : "HOMEWORK_AUTOMATIC_FAILED", message: error instanceof AppError ? error.message : "Automatic hand-in could not complete. Retry or review the prepared work." });
    }
  }
  return issues;
}
export async function recoverHomeworkForStudent(scope: HomeworkStudentScope) {
  return recover(scope, scope.groupId, scope.user.id);
}
export async function recoverHomeworkForClass(scope: HomeworkTeacherScope, groupId?: string) {
  if (groupId) await assertCanGradeGroup(scope.user, scope.courseId, groupId); else await assertCanManageCourse(scope.user, scope.courseId);
  return recover(scope, groupId);
}
