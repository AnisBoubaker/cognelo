import { resolvePluginGradeCompletionHandler, type PluginGradeCompletion } from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import type { getCourseGradebook } from "@cognelo/core";

type CoreCourseGradebook = Awaited<ReturnType<typeof getCourseGradebook>>;

export type GradeCompletion = PluginGradeCompletion | {
  status: "ungraded";
  completedComponentCount: 0;
  requiredComponentCount: 1;
};

export async function resolveCourseGradebookCompletions(user: CurrentUser, courseId: string, gradebook: CoreCourseGradebook) {
  const pluginCompletions = new Map<string, PluginGradeCompletion>();
  const rowsByActivity = new Map<string, typeof gradebook.rows>();

  for (const row of gradebook.rows) {
    if (row.score === null || isUngradedRow(row)) continue;
    const key = `${row.activityTypeKey}:${row.activityId}`;
    const rows = rowsByActivity.get(key) ?? [];
    rows.push(row);
    rowsByActivity.set(key, rows);
  }

  await Promise.all([...rowsByActivity.entries()].map(async ([key, rows]) => {
    const first = rows[0];
    const handler = resolvePluginGradeCompletionHandler(first.activityTypeKey);
    if (!handler) return;
    const completions = await handler({
      user,
      courseId,
      activityId: first.activityId,
      rows: rows.map((row) => ({
        participantId: row.participantId,
        score: row.score as number,
        gradeSource: row.gradeSource,
        feedback: asRecord(row.feedback),
        gradingResult: row.gradeCompletionContext.gradingResult
      }))
    });
    Object.entries(completions).forEach(([participantId, completion]) => {
      pluginCompletions.set(completionKey(key, participantId), completion);
    });
  }));

  const rows = gradebook.rows.map((row) => {
    const { gradeCompletionContext: _gradeCompletionContext, ...publicRow } = row;
    const activityKey = `${row.activityTypeKey}:${row.activityId}`;
    const gradeCompletion: GradeCompletion | null = row.submittedAttemptCount === 0 && row.score === null
      ? null
      : isUngradedRow(row)
        ? { status: "ungraded", completedComponentCount: 0, requiredComponentCount: 1 }
        : pluginCompletions.get(completionKey(activityKey, row.participantId))
          ?? { status: "complete", completedComponentCount: 1, requiredComponentCount: 1 };
    return { ...publicRow, gradeCompletion };
  });
  const rowsByItem = new Map<string, typeof rows>();
  rows.forEach((row) => {
    const itemRows = rowsByItem.get(row.gradebookItemId) ?? [];
    itemRows.push(row);
    rowsByItem.set(row.gradebookItemId, itemRows);
  });
  const items = gradebook.items.map((item) => {
    const incompleteGradeCount = (rowsByItem.get(item.gradebookItemId) ?? []).filter((row) =>
      row.submittedAttemptCount > 0 && row.gradeCompletion?.status !== "complete"
    ).length;
    return {
      ...item,
      incompleteGradeCount,
      canReleaseGrades: incompleteGradeCount === 0
    };
  });

  return { ...gradebook, items, rows };
}

function isUngradedRow(row: CoreCourseGradebook["rows"][number]) {
  return row.submittedAttemptCount > 0 && (
    row.score === null || (row.needsGradingCount > 0 && row.gradeSource !== "override")
  );
}

function completionKey(activityKey: string, participantId: string) {
  return `${activityKey}:${participantId}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
