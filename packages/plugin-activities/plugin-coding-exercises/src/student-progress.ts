import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { prisma } from "@cognelo/db";
import { assignmentAssessmentMode, getCourseActivityProgress } from "@cognelo/core";
import { getCodingExerciseInitialStudentSource } from "./web/coding-exercise-student-source";

/** Empty/unchanged editor initialization is not evidence of another submission in progress. */
export const codingExerciseStudentProgress: NonNullable<ServerActivityPlugin["studentProgress"]> = {
  activityTypeKeys: ["coding-exercise"],
  async getProgress(input) {
    // Older dev route modules may survive hot reload while the plugin registration is refreshed.
    const progress = input.progress ?? (await getCourseActivityProgress(input.user, input.courseId, input.activityId)).progress;
    const candidates = progress.filter(progress => progress.state === "in_progress" && progress.submittedAt && !progress.attemptNumber);
    const roster = input.participants.filter(person => candidates.some(progress => progress.participantId === person.participantId && progress.groupId === person.groupId))
      .map(person => ({ ...person, mode: assignmentAssessmentMode(input.assignmentMetadata[person.groupId]) }));
    if (!roster.length) return [];
    const activity = await prisma.activity.findFirst({ where: { id: input.activityId, courseId: input.courseId }, select: { config: true } });
    if (!activity) return [];
    const initialSource = getCodingExerciseInitialStudentSource(activity.config as Record<string, unknown>).trim();
    // Compare source inside the database and return only lifecycle/evidence flags, never code.
    const rows = await prisma.$queryRaw<Array<{ participantId: string; groupId: string; completed: boolean; hasNewWork: boolean }>>`
      WITH authorized AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(roster)}::jsonb)
        AS p("participantId" text,"groupId" text,"userId" text,mode text))
      SELECT p."participantId",p."groupId",a.lifecycle IN ('submitted','graded') AS completed,
        coalesce(d."updatedAt">a."submittedAt" AND jsonb_typeof(d.state->'sourceCode')='string'
          AND code.source<>'' AND code.source<>${initialSource}
          AND code.source IS DISTINCT FROM code.submitted,false) AS "hasNewWork"
      FROM authorized p JOIN "CourseGroupActivity" ga ON ga."activityId"=${input.activityId} AND ga."groupId"=p."groupId"
      JOIN LATERAL (SELECT lifecycle,"submittedAt",metadata FROM "ActivityAttempt" aa WHERE aa."courseId"=${input.courseId}
        AND aa."activityId"=${input.activityId} AND aa."groupActivityId"=ga.id AND aa."participantId"=p."participantId"
        AND aa."assessmentMode"::text=p.mode AND aa.lifecycle<>'deleted' ORDER BY aa."attemptNumber" DESC,aa.id DESC LIMIT 1) a ON true
      LEFT JOIN "ActivityResponseDraft" d ON d."groupActivityId"=ga.id AND d."participantId"=p."participantId"
      CROSS JOIN LATERAL (SELECT btrim(d.state->>'sourceCode',chr(9)||chr(10)||chr(13)||' ') AS source,
        btrim(a.metadata->>'submittedSourceCode',chr(9)||chr(10)||chr(13)||' ') AS submitted) code`;
    return rows.filter(row => row.completed && !row.hasNewWork).map(row => ({ participantId: row.participantId, groupId: row.groupId, state: "done" as const }));
  }
};
