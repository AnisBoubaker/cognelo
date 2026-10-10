import { NextRequest } from "next/server";
import {
  AppError,
  getCourseGradebook,
  getCourseGradebookCsv,
  listCourseActivityInProgressAttempts,
  type CourseGradebookStatusFilter
} from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
import { resolveCourseGradebookCompletions } from "@/lib/gradebook-completion";
import { summarizeCourseGradebook } from "@/lib/gradebook-summary";

type Params = { params: Promise<{ courseId: string }> };

const statusFilters = new Set<CourseGradebookStatusFilter>(["all", "missing", "late", "needs_grading", "graded"]);

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const filters = {
      groupId: searchParams.get("groupId") || null,
      activityId: searchParams.get("activityId") || null,
      status: parseStatus(searchParams.get("status"))
    };

    if (searchParams.get("view") === "in-progress-attempts") {
      if (!filters.activityId) {
        throw new AppError(400, "ACTIVITY_REQUIRED", "An activity is required to list in-progress attempts.");
      }
      return json({
        attempts: await listCourseActivityInProgressAttempts(user, courseId, filters.activityId, filters.groupId)
      });
    }

    if (searchParams.get("format") === "csv") {
      const csv = await getCourseGradebookCsv(user, courseId, filters);
      return new Response(csv, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="course-${courseId}-gradebook.csv"`,
          "Content-Type": "text/csv; charset=utf-8"
        }
      });
    }

    let gradebook = await resolveCourseGradebookCompletions(
      user,
      courseId,
      await getCourseGradebook(user, courseId, filters)
    );
    if (filters.status !== "all") {
      const completeGradebook = await resolveCourseGradebookCompletions(
        user,
        courseId,
        await getCourseGradebook(user, courseId, { ...filters, status: "all" })
      );
      const readinessByItem = new Map(completeGradebook.items.map((item) => [item.gradebookItemId, item]));
      gradebook = {
        ...gradebook,
        items: gradebook.items.map((item) => ({
          ...item,
          incompleteGradeCount: readinessByItem.get(item.gradebookItemId)?.incompleteGradeCount ?? item.incompleteGradeCount,
          canReleaseGrades: readinessByItem.get(item.gradebookItemId)?.canReleaseGrades ?? item.canReleaseGrades
        }))
      };
    }

    return json({
      gradebook: searchParams.get("view") === "summary"
        ? summarizeCourseGradebook(gradebook)
        : gradebook
    });
  });
}

function parseStatus(value: string | null) {
  return value && statusFilters.has(value as CourseGradebookStatusFilter) ? (value as CourseGradebookStatusFilter) : "all";
}
