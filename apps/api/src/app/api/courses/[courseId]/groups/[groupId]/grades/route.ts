import { getStudentReleasedGrades } from "@cognelo/core";
import { resolvePluginStudentGradeReportHandler } from "@cognelo/activity-sdk/server";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: Request, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    const grades = await getStudentReleasedGrades(user, courseId, groupId);
    const rows = await Promise.all(grades.rows.map(async (row) => {
      const getReport = row.gradeKind === "final" && !row.contentClosed
        ? resolvePluginStudentGradeReportHandler(row.activityTypeKey)
        : null;
      const feedback = row.feedback;
      if (row.gradeKind === "final" && !row.contentClosed && row.activityTypeKey === "test" && Array.isArray(feedback?.details?.items)) {
        feedback.details.items = await Promise.all(feedback.details.items.map(async (value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) return value;
          const item = value as Record<string, unknown>;
          if (typeof item.activityTypeKey !== "string" || typeof item.activityId !== "string" || typeof item.testItemId !== "string") return item;
          const childReport = resolvePluginStudentGradeReportHandler(item.activityTypeKey);
          return { ...item, gradingReport: childReport ? await childReport({
            user, courseId, groupId, activityId: item.activityId,
            gradebookItemId: row.gradebookItemId,
            selectedAttemptId: row.selectedAttemptId ?? row.challengeAttemptId,
            testItemId: item.testItemId
          }) : null };
        }));
      }
      return {
        ...row,
        gradingReport: getReport
          ? await getReport({
              user,
              courseId,
              groupId,
              activityId: row.activityId,
              gradebookItemId: row.gradebookItemId,
              selectedAttemptId: row.selectedAttemptId
            })
          : null
      };
    }));
    return json({ grades: { ...grades, rows } });
  });
}
