import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import type { ActivityLogEvidence, ActivityStudentAction } from "@cognelo/contracts";
import { prisma } from "./db-client";
import { currentHomeworkReportTargets } from "./gradebook-actions";
import { cancelHomeworkSubmission } from "./submission-management";
import { resetHomeworkStudentChallenges } from "./team-management";
import { recoverHomeworkForClass } from "./automatic-hand-in";
import { homeworkWorkflowCopy } from "./web/workflow-copy";

const localized = (field: keyof ReturnType<typeof homeworkWorkflowCopy>) => Object.fromEntries((["en", "fr", "zh", "ar"] as const).map(locale => [locale, homeworkWorkflowCopy(locale)[field]]));
export const homeworkReports: NonNullable<ServerActivityPlugin["reports"]> = {
  activityTypeKeys: ["coding-homework-grader"],
  studentActions: {
    async list(context) {
      const scope = { user: context.user, courseId: context.courseId, activityId: context.activity.id };
      // Preserve existing teacher-read deadline recovery, now owned by action discovery.
      const issues = context.recoverAutomatic ? (await Promise.all([...new Set(context.participants.map(person => person.groupId))].map(groupId => recoverHomeworkForClass(scope, groupId)))).flat() : [];
      const actions: ActivityStudentAction[] = [];
      for (const target of await currentHomeworkReportTargets(context)) {
        const base = { participantId: target.participantId, groupId: target.groupId, targetId: target.submissionId };
        actions.push({ ...base, id: "cancel-submission", icon: "cancel", labels: localized(target.team ? "cancelTeamSubmission" : "cancelSubmission"), messages: localized(target.team ? "cancelTeamDetail" : "cancelDetail"), reasonLabels: localized("cancelReason") });
        if (target.questionsEnabled) actions.push({ ...base, id: "reset-challenges", icon: "reset", labels: localized("resetChallenges"), messages: localized("resetChallengesDetail"), reasonLabels: localized("resetChallengesReason") });
      }
      return { actions, issues: issues.map(issue => `${issue.student}: ${issue.message}`) };
    },
    async execute(context) {
      const scope = { user: context.user, courseId: context.courseId, activityId: context.activity.id };
      if (context.actionId === "cancel-submission") await cancelHomeworkSubmission(scope, { submissionId: context.targetId, reason: context.reason });
      else if (context.actionId === "reset-challenges") await resetHomeworkStudentChallenges(scope, context.targetId, context.reason);
    }
  },
  async logs(context) {
    if (!context.participants.length) return [];
    const roster = JSON.stringify(context.participants.map(person => ({ participantId: person.participantId, groupId: person.groupId, userId: person.userId })));
    const rows = await prisma.$queryRaw<Array<Omit<ActivityLogEvidence, "at"> & { at: Date }>>`
      WITH authorized AS (SELECT * FROM jsonb_to_recordset(${roster}::jsonb) AS p("participantId" text,"groupId" text,"userId" text)),
      events AS (
        SELECT p."participantId",p."groupId",event.id,event.at,event.type,event."actorUserId",event.reason
        FROM authorized p JOIN "PluginCodingHomeworkSubmission" s ON s."activityId"=${context.activity.id} AND s."groupId"=p."groupId" AND s."userId"=p."userId" AND s.kind='final'
        LEFT JOIN LATERAL (SELECT e."actorUserId" FROM "PluginCodingHomeworkWorkspaceEvent" e WHERE e."activityId"=${context.activity.id} AND e."groupId"=p."groupId"
          AND e.operation='submitted' AND e.metadata->>'sourceId'=s."sharedSourceId" ORDER BY e."createdAt" LIMIT 1) handin ON true
        LEFT JOIN "BackgroundJob" job ON job.queue='coding-homework-grader' AND job."idempotencyKey"='submission:'||coalesce(s.metadata->>'generationSourceId',s.id)
        LEFT JOIN LATERAL (SELECT min(q."createdAt") AS at FROM "PluginCodingHomeworkChallengeQuestion" q WHERE q."submissionId"=s.id) questions ON true
        CROSS JOIN LATERAL (VALUES
          ('homework:files:'||s.id,CASE WHEN NOT s.metadata ? 'resetFrom' AND (s."workspaceId" IS NULL OR NOT EXISTS(
            SELECT 1 FROM "PluginCodingHomeworkSubmission" earlier WHERE earlier."activityId"=s."activityId" AND earlier."groupId"=s."groupId"
              AND earlier."userId"=s."userId" AND earlier.kind='final' AND earlier."sharedSourceId"=s."sharedSourceId"
              AND (earlier."createdAt",earlier.id)<(s."createdAt",s.id))) THEN s."createdAt" END,
            CASE WHEN s.metadata ? 'automaticHandIn' THEN 'automatic_hand_in' ELSE 'files_submitted' END,
            CASE WHEN s.metadata ? 'automaticHandIn' THEN s.metadata->'automaticHandIn'->>'triggeredBy'
              WHEN s."workspaceId" IS NULL THEN s."userId" ELSE handin."actorUserId" END,NULL::text),
          ('homework:cancel:'||s.id,(s.metadata->'cancellation'->>'cancelledAt')::timestamptz,
            CASE WHEN EXISTS(SELECT 1 FROM "PluginCodingHomeworkSubmission" newer WHERE newer."activityId"=s."activityId" AND newer.metadata->>'resetFrom'=s.id)
              OR EXISTS(SELECT 1 FROM "PluginCodingHomeworkWorkspaceEvent" e WHERE e."activityId"=s."activityId" AND e."groupId"=p."groupId" AND e.operation='student_challenges_reset' AND e.metadata->>'previousSubmissionId'=s.id)
              THEN 'challenges_reset' ELSE 'submission_cancelled' END,
            s.metadata->'cancellation'->>'cancelledBy',s.metadata->'cancellation'->>'reason'),
          ('homework:ready:'||s.id,questions.at,'questions_ready',NULL::text,NULL::text),
          ('homework:failure:'||s.id,job."failedAt",'processing_failed',NULL::text,NULL::text)
        ) event(id,at,type,"actorUserId",reason)
      ) SELECT * FROM events WHERE at IS NOT NULL AND (${context.before?.at ?? null}::timestamptz IS NULL
        OR (at,id)<(${context.before?.at ?? null}::timestamptz,${context.before?.id ?? ""}::text))
      ORDER BY at DESC,id DESC LIMIT ${context.limit}`;
    return rows.map(row => ({ ...row, at: row.at.toISOString() }));
  }
};
