import { NextRequest } from "next/server";
import { getTimedActivityRuntime, startOrResumeTimedActivityAttempt } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
import { requireSafeExamBrowserAccess } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId, { receiptOnly: true });
    return json({ runtime: await getTimedActivityRuntime(user, courseId, groupId, activityId) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId);
    return json({ runtime: await startOrResumeTimedActivityAttempt(user, courseId, groupId, activityId) }, { status: 201 });
  });
}
