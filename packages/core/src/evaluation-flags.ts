import { EvaluationFlagSchema, type CurrentUser, type EvaluationFlag } from "@cognelo/contracts";
import { resolvePluginEvaluationFlagHandler, type PluginEvaluationFlagRow } from "@cognelo/activity-sdk/server";
import { assertCanGradeGroup } from "./authorization";

type Row = {
  activityId: string; activityTypeKey: string; groupId: string; participantId: string; assessmentMode: string;
  feedback: Record<string, unknown> | null; gradeCompletionContext: { gradingResult: Record<string, unknown>; evaluationAttemptId?: string | null; evaluationFeedback?: { attemptId: string; feedback: Record<string, unknown> } };
  attempts: Array<{ id: string; lifecycle: string; assessmentMode: string; attemptNumber: number; pluginAttemptRef: string | null }>;
};
export const evaluationFlagRowKey = (row: Pick<Row, "activityId" | "groupId" | "participantId">) => `${row.activityId}:${row.groupId}:${row.participantId}`;

/** Call with the host-authorized gradebook roster; no plugin-private tables or academic mutations. */
export async function getGradebookEvaluationFlags(user: CurrentUser, courseId: string, rows: readonly Row[]) {
  const groups = new Map<string, { activityTypeKey: string; rows: PluginEvaluationFlagRow[] }>();
  for (const row of rows) {
    if (row.assessmentMode !== "summative" || !resolvePluginEvaluationFlagHandler(row.activityTypeKey)) continue;
    const latest = row.attempts.filter(attempt => attempt.assessmentMode === "summative" && attempt.lifecycle !== "deleted").sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    if (!latest || !["submitted", "graded"].includes(latest.lifecycle)) continue;
    const group = groups.get(row.activityId) ?? { activityTypeKey: row.activityTypeKey, rows: [] };
    const attemptFeedback = row.gradeCompletionContext.evaluationFeedback;
    const gradeApplies = row.gradeCompletionContext.evaluationAttemptId === undefined || row.gradeCompletionContext.evaluationAttemptId === latest.id;
    group.rows.push({ participantId: row.participantId, groupId: row.groupId, attemptId: latest.id, pluginAttemptRef: latest.pluginAttemptRef,
      feedback: (gradeApplies ? row.feedback : null) ?? (attemptFeedback?.attemptId === latest.id ? attemptFeedback.feedback : null),
      gradingResult: gradeApplies ? row.gradeCompletionContext.gradingResult : {} });
    groups.set(row.activityId, group);
  }
  const result = new Map<string, EvaluationFlag[]>();
  await Promise.all([...groups].map(async ([activityId, group]) => {
    for (const groupId of new Set(group.rows.map(row => row.groupId))) await assertCanGradeGroup(user, courseId, groupId);
    const supplied = await resolvePluginEvaluationFlagHandler(group.activityTypeKey)!({ user, courseId, activityId, rows: group.rows });
    for (const row of group.rows) {
      const flags = (supplied[row.participantId] ?? []).slice(0, 10).map(flag => EvaluationFlagSchema.parse(flag));
      result.set(evaluationFlagRowKey({ activityId, ...row }), flags);
    }
  }));
  return result;
}
