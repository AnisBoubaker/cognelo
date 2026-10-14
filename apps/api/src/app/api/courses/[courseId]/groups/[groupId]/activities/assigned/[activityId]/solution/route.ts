import { NextRequest } from "next/server";
import { getActivitySolution, getActivitySolutionAvailability } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
import { requireSafeExamBrowserAccess } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export function OPTIONS() { return options(); }

function handle(request: NextRequest, { params }: Params, reveal: boolean) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    return json(reveal
      ? { solution: await getActivitySolution(user, courseId, groupId, activityId) }
      : await getActivitySolutionAvailability(user, courseId, groupId, activityId));
  });
}

export function GET(request: NextRequest, params: Params) { return handle(request, params, false); }
export function POST(request: NextRequest, params: Params) { return handle(request, params, true); }
