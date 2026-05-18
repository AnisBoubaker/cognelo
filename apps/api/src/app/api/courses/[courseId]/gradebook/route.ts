import { NextRequest } from "next/server";
import { getCourseGradebook, getCourseGradebookCsv, type CourseGradebookStatusFilter } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

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

    return json({ gradebook: await getCourseGradebook(user, courseId, filters) });
  });
}

function parseStatus(value: string | null) {
  return value && statusFilters.has(value as CourseGradebookStatusFilter) ? (value as CourseGradebookStatusFilter) : "all";
}
