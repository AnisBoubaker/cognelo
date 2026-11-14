import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { assignmentAssessmentMode } from "@cognelo/core";
import { prisma } from "./db-client";

/** Parsons persists arrangements privately instead of using the generic draft. */
export const parsonsStudentProgress: NonNullable<ServerActivityPlugin["studentProgress"]> = {
  activityTypeKeys: ["parsons-problem"],
  async getProgress(input) {
    const roster = input.participants.filter(person => person.userId);
    if (!roster.length) return [];
    const rows = await prisma.$queryRaw<Array<{ participantId: string; groupId: string; working: boolean; completed: boolean }>>`
      WITH authorized AS (SELECT * FROM unnest(${roster.map(p => p.participantId)}::text[],${roster.map(p => p.groupId)}::text[],
        ${roster.map(p => p.userId)}::text[],${roster.map(p => assignmentAssessmentMode(input.assignmentMetadata[p.groupId]))}::text[])
        AS p("participantId","groupId","userId",mode))
      SELECT p."participantId",p."groupId",
        coalesce(a.started,false) OR (pa.id IS NOT NULL AND pa.status='in_progress'
          AND (a."lastAnySubmission" IS NULL OR pa."lastInteractionAt">a."lastAnySubmission")) AS working,
        a."lastSubmission" IS NOT NULL AS completed
      FROM authorized p
      LEFT JOIN LATERAL (SELECT id,status,"lastInteractionAt" FROM "PluginParsonsAttempt"
        WHERE "activityId"=${input.activityId} AND "userId"=p."userId" ORDER BY "lastInteractionAt" DESC,id DESC LIMIT 1) pa ON true
      LEFT JOIN LATERAL (SELECT bool_or(aa.lifecycle='started' AND aa."assessmentMode"::text=p.mode) AS started,
        max(aa."submittedAt") FILTER(WHERE aa.lifecycle IN ('submitted','graded') AND aa."assessmentMode"::text=p.mode) AS "lastSubmission",
        max(aa."submittedAt") FILTER(WHERE aa.lifecycle IN ('submitted','graded')) AS "lastAnySubmission"
        FROM "ActivityAttempt" aa WHERE aa."courseId"=${input.courseId} AND aa."activityId"=${input.activityId}
          AND aa."groupId"=p."groupId" AND aa."participantId"=p."participantId" AND aa.lifecycle<>'deleted') a ON true`;
    return rows.map(row => ({ participantId: row.participantId, groupId: row.groupId,
      state: row.working ? "in_progress" : row.completed ? "done" : "not_started" }));
  }
};
