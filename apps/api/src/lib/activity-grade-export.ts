import type { CurrentUser } from "@cognelo/contracts";
import { getCourseGradebook } from "@cognelo/core";
import { resolveCourseGradebookCompletions } from "./gradebook-completion";

export type ActivityGradeExportRow = {
  email: string;
  firstName: string;
  lastName: string;
  grade: number;
};

export async function getActivityFinalGradeExportRows(
  user: CurrentUser,
  courseId: string,
  activityId: string,
  groupId?: string | null
): Promise<ActivityGradeExportRow[]> {
  const gradebook = await resolveCourseGradebookCompletions(
    user,
    courseId,
    await getCourseGradebook(user, courseId, {
      activityId,
      groupId: groupId ?? null,
      status: "all"
    })
  );

  return gradebook.rows
    .filter((row) => row.score !== null && Number.isFinite(row.score) && row.gradeCompletion?.status === "complete")
    .map((row) => ({
      email: row.participantEmail,
      firstName: row.participantFirstName,
      lastName: row.participantLastName,
      grade: row.score as number
    }))
    .sort(compareExportRows);
}

function compareExportRows(left: ActivityGradeExportRow, right: ActivityGradeExportRow) {
  return left.lastName.localeCompare(right.lastName)
    || left.firstName.localeCompare(right.firstName)
    || left.email.localeCompare(right.email);
}
