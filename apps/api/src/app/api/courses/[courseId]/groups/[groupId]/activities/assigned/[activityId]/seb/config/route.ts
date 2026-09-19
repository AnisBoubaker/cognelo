import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { AppError, verifySafeExamBrowserLaunchToken } from "@cognelo/core";
import { handleRoute, options } from "@/lib/http";
import { buildSafeExamBrowserConfiguration } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      throw new AppError(400, "SAFE_EXAM_BROWSER_LAUNCH_TOKEN_REQUIRED", "A Safe Exam Browser launch token is required.");
    }
    const scope = await verifySafeExamBrowserLaunchToken(token, getServerEnv().JWT_SECRET);
    const routeScope = await params;
    if (
      scope.courseId !== routeScope.courseId ||
      scope.groupId !== routeScope.groupId ||
      scope.activityId !== routeScope.activityId
    ) {
      throw new AppError(403, "SAFE_EXAM_BROWSER_LAUNCH_SCOPE_INVALID", "This launch link belongs to another activity.");
    }
    const config = buildSafeExamBrowserConfiguration(routeScope, token);
    return new NextResponse(config.body, {
      headers: {
        "Cache-Control": "private, no-store, no-transform",
        "Content-Disposition": 'attachment; filename="cognelo-exam.seb"',
        "Content-Type": "application/seb",
        "X-Content-Type-Options": "nosniff"
      }
    });
  });
}
