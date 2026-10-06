import { NextRequest } from "next/server";
import { AppError } from "@cognelo/core";
import { getActivityFinalGradeExportRows } from "@/lib/activity-grade-export";
import {
  activityGradeExportContentDisposition,
  createActivityGradeCsv,
  createActivityGradeXlsx,
  type ActivityGradeExportFormat
} from "@/lib/activity-grade-export-file";
import { handleRoute, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const format = parseFormat(request.nextUrl.searchParams.get("format"));
    const groupId = request.nextUrl.searchParams.get("groupId") || null;
    const fileName = request.nextUrl.searchParams.get("fileName") || "grades";
    const rows = await getActivityFinalGradeExportRows(user, courseId, activityId, groupId);
    const body = format === "csv" ? createActivityGradeCsv(rows) : createActivityGradeXlsx(rows);

    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": activityGradeExportContentDisposition(fileName, format),
        "Content-Type": format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    });
  });
}

function parseFormat(value: string | null): ActivityGradeExportFormat {
  if (value === "csv" || value === "xlsx") return value;
  throw new AppError(400, "INVALID_GRADE_EXPORT_FORMAT", "The export format must be CSV or XLSX.");
}
