import type { ActivityStudentProgress } from "@cognelo/contracts";
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { activityTeamAssignment, activityTeamworkEnabled } from "@cognelo/core";
import { prisma } from "./db-client";

type ProgressEvidence = {
  participantId: string; groupId: string; hasDraft: boolean; hasSubmission: boolean;
  status: string | null; questionsEnabled: boolean; answeringStarted: boolean;
};

export function homeworkStudentProgress(evidence: ProgressEvidence): ActivityStudentProgress {
  const base = { participantId: evidence.participantId, groupId: evidence.groupId };
  if (evidence.hasSubmission) {
    if (!evidence.questionsEnabled || ["answered", "ready_for_grading", "graded"].includes(evidence.status ?? "")) return { ...base, state: "done" };
    if (evidence.answeringStarted) return { ...base, state: "in_progress", stageId: "questions" };
    return { ...base, state: "stage_submitted", stageId: "files" };
  }
  return evidence.hasDraft ? { ...base, state: "in_progress", stageId: "files" } : { ...base, state: "not_started" };
}

/** One read-only batch. No draft/member creation, recovery, question generation or locks. */
export const homeworkStudentProgressService: NonNullable<ServerActivityPlugin["studentProgress"]> = {
  activityTypeKeys: ["coding-homework-grader"],
  async getProgress(input) {
    if (!input.participants.length) return [];
    const team = activityTeamworkEnabled(input.activityMetadata);
    const roster = input.participants.map(person => {
      const assignment = activityTeamAssignment(input.assignmentMetadata[person.groupId]);
      return { ...person, groupingId: assignment?.groupingId ?? null, allowIndividual: assignment?.allowIndividualSubmission ?? false };
    });
    // JSON keeps nullable roster columns typed consistently in Prisma's cached statements.
    const rows = await prisma.$queryRaw<ProgressEvidence[]>`
      WITH authorized AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(roster)}::jsonb)
        AS p("participantId" text,"groupId" text,"userId" text,"groupingId" text,"allowIndividual" boolean)
      ), evidence AS (
        SELECT p."participantId",p."groupId",s.status,s.metadata,s."coreAttemptId",a.lifecycle,
          CASE WHEN ${team} THEN w.id IS NOT NULL AND (jsonb_array_length(w.files)>0 OR w."preparationStartedAt" IS NOT NULL)
            ELSE d.id IS NOT NULL AND (jsonb_array_length(d.files)>0 OR d."preparationStartedAt" IS NOT NULL) END AS "hasDraft",
          CASE WHEN ${team} THEN s.id IS NOT NULL AND s."workspaceId"=w.id AND s."workspaceMemberId"=m.id
            AND m."currentSubmissionId"=s.id AND s."sharedSourceId"=w."currentSubmissionId"
            ELSE s.id IS NOT NULL AND s."workspaceId" IS NULL END AS "validIndividual",
          src.id IS NOT NULL AND src.status<>'cancelled' AND NOT src.metadata ? 'deletion' AS "sharedHandIn",
          src.metadata AS "sharedMetadata"
        FROM authorized p
        LEFT JOIN LATERAL (SELECT * FROM "PluginCodingHomeworkSubmission" sub WHERE sub."activityId"=${input.activityId}
          AND sub."groupId"=p."groupId" AND sub."userId"=p."userId" AND sub.kind='final'
          ORDER BY sub."createdAt" DESC,sub.id DESC LIMIT 1) s ON true
        LEFT JOIN "ActivityAttempt" a ON a.id=s."coreAttemptId" AND a."courseId"=${input.courseId} AND a."activityId"=${input.activityId}
          AND a."groupId"=p."groupId" AND a."participantId"=p."participantId" AND a."userId"=p."userId"
        LEFT JOIN "PluginCodingHomeworkDraft" d ON d."activityId"=${input.activityId} AND d."groupId"=p."groupId" AND d."userId"=p."userId"
        LEFT JOIN "PluginCodingHomeworkWorkspaceMember" m ON m."activityId"=${input.activityId} AND m."groupId"=p."groupId" AND m."participantId"=p."participantId"
          AND m."userId" IS NOT DISTINCT FROM p."userId"
        LEFT JOIN "PluginCodingHomeworkWorkspace" w ON w.id=m."workspaceId" AND w."courseId"=${input.courseId} AND w."activityId"=${input.activityId}
          AND w."groupId"=p."groupId" AND w."groupingId"=p."groupingId"
          AND ((w."teamId" IS NOT NULL AND EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."participantId"=p."participantId"
            AND tm."groupingId"=w."groupingId" AND tm."teamId"=w."teamId"))
            OR (w."teamId" IS NULL AND w."ownerParticipantId"=p."participantId" AND p."allowIndividual"
              AND NOT EXISTS(SELECT 1 FROM "StudentTeamMember" tm WHERE tm."participantId"=p."participantId" AND tm."groupingId"=w."groupingId")))
        LEFT JOIN "PluginCodingHomeworkSubmission" src ON src.id=w."currentSubmissionId" AND src."workspaceId"=w.id AND src.kind::text='team_source'
      ) SELECT "participantId","groupId",coalesce("hasDraft",false) AS "hasDraft",
        coalesce("validIndividual" AND status NOT IN ('cancelled','invalid_structure') AND NOT metadata ? 'deletion'
          AND ("coreAttemptId" IS NULL OR (lifecycle IS NOT NULL AND lifecycle<>'deleted'))
          OR (${team} AND "sharedHandIn" AND "coreAttemptId" IS NULL AND NOT coalesce(metadata ? 'deletion',false)),false) AS "hasSubmission",
        CASE WHEN "validIndividual" THEN status ELSE NULL END AS status,
        coalesce((CASE WHEN "validIndividual" THEN metadata ELSE "sharedMetadata" END)->>'questionGenerationEnabled','true')<>'false' AS "questionsEnabled",
        coalesce("validIndividual" AND (lifecycle='started' OR (metadata->>'assessmentStartedAt' IS NOT NULL)),false) AS "answeringStarted"
      FROM evidence`;
    return rows.map(homeworkStudentProgress);
  }
};
