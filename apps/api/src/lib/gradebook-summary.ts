import type { resolveCourseGradebookCompletions } from "./gradebook-completion";

type ResolvedCourseGradebook = Awaited<ReturnType<typeof resolveCourseGradebookCompletions>>;

export type CourseGradebookGroupSummary = {
  groupId: string;
  groupTitle: string;
  gradebookItemId: string;
  gradesReleased: boolean;
  assessmentMode: "formative" | "summative";
  studentCount: number;
  submissionCount: number;
  gradedCount: number;
  incompleteGradeCount: number;
  meanScore: number | null;
  meanMaxScore: number | null;
};

export type CourseGradebookActivitySummary = {
  activityId: string;
  activityTitle: string;
  activityTypeName: string;
  assessmentMode: "formative" | "summative";
  gradebookItemIds: string[];
  allGradesReleased: boolean;
  submissionCount: number;
  gradedCount: number;
  incompleteGradeCount: number;
  meanScore: number | null;
  meanMaxScore: number | null;
  groups: CourseGradebookGroupSummary[];
};

export function summarizeCourseGradebook(gradebook: ResolvedCourseGradebook) {
  const rowsByItem = new Map<string, ResolvedCourseGradebook["rows"]>();
  for (const row of gradebook.rows) {
    const existing = rowsByItem.get(row.gradebookItemId) ?? [];
    existing.push(row);
    rowsByItem.set(row.gradebookItemId, existing);
  }

  const itemsByActivity = new Map<string, ResolvedCourseGradebook["items"]>();
  for (const item of gradebook.items) {
    const existing = itemsByActivity.get(item.activityId) ?? [];
    existing.push(item);
    itemsByActivity.set(item.activityId, existing);
  }

  const activitySummaries: CourseGradebookActivitySummary[] = [...itemsByActivity.values()]
    .map((activityItems) => {
      const first = activityItems[0];
      const activityRows = activityItems.flatMap((item) => rowsByItem.get(item.gradebookItemId) ?? []);
      const groups = activityItems
        .map((item) => summarizeGradebookGroup(item, rowsByItem.get(item.gradebookItemId) ?? []))
        .sort((left, right) => left.groupTitle.localeCompare(right.groupTitle));

      return {
        activityId: first.activityId,
        activityTitle: first.activityTitle,
        activityTypeName: first.activityTypeName,
        assessmentMode: first.assessmentMode,
        gradebookItemIds: activityItems.map((item) => item.gradebookItemId),
        allGradesReleased: groups.length > 0 && groups.every((group) => group.gradesReleased),
        submissionCount: sum(groups.map((group) => group.submissionCount)),
        gradedCount: sum(groups.map((group) => group.gradedCount)),
        incompleteGradeCount: sum(groups.filter((group) => !group.gradesReleased).map((group) => group.incompleteGradeCount)),
        ...meanGradeForRows(activityRows),
        groups
      };
    });

  return {
    filters: gradebook.filters,
    groups: gradebook.groups,
    activities: gradebook.activities,
    overview: buildGradebookOverview(activitySummaries),
    activitySummaries
  };
}

function summarizeGradebookGroup(
  item: ResolvedCourseGradebook["items"][number],
  rows: ResolvedCourseGradebook["rows"]
): CourseGradebookGroupSummary {
  return {
    groupId: item.groupId,
    groupTitle: item.groupTitle,
    gradebookItemId: item.gradebookItemId,
    gradesReleased: item.gradesReleased,
    assessmentMode: item.assessmentMode,
    studentCount: item.studentCount,
    submissionCount: sum(rows.map((row) => row.submittedAttemptCount)),
    gradedCount: rows.filter((row) => row.score !== null).length,
    incompleteGradeCount: item.incompleteGradeCount,
    ...meanGradeForRows(rows)
  };
}

function buildGradebookOverview(activities: CourseGradebookActivitySummary[]) {
  const rowsForMean = activities.flatMap((activity) =>
    activity.meanScore === null || activity.meanMaxScore === null
      ? []
      : [{ score: activity.meanScore, maxScore: activity.meanMaxScore }]
  );

  return {
    activityCount: activities.length,
    submissionCount: sum(activities.map((activity) => activity.submissionCount)),
    gradedCount: sum(activities.map((activity) => activity.gradedCount)),
    meanScore: rowsForMean.length
      ? roundGrade(rowsForMean.reduce((total, row) => total + row.score, 0) / rowsForMean.length)
      : null,
    meanMaxScore: rowsForMean.length
      ? roundGrade(rowsForMean.reduce((total, row) => total + row.maxScore, 0) / rowsForMean.length)
      : null
  };
}

function meanGradeForRows(rows: ResolvedCourseGradebook["rows"]) {
  const gradedRows = rows.filter((row) => row.score !== null);
  if (!gradedRows.length) {
    return { meanScore: null, meanMaxScore: null };
  }

  return {
    meanScore: roundGrade(gradedRows.reduce((total, row) => total + (row.score ?? 0), 0) / gradedRows.length),
    meanMaxScore: roundGrade(gradedRows.reduce((total, row) => total + row.maxScore, 0) / gradedRows.length)
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundGrade(value: number) {
  return Math.round(value * 100) / 100;
}
