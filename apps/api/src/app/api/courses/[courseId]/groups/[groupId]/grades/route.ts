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
      const getReport = row.gradeKind === "final"
        ? resolvePluginStudentGradeReportHandler(row.activityTypeKey)
        : null;
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
