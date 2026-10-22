import { NextRequest } from "next/server";
import { finalizeExpiredTimedActivityAttempt } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
import { requireSafeExamBrowserAccess } from "@/lib/safe-exam-browser";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    await requireSafeExamBrowserAccess(request, user, courseId, groupId, activityId, { receiptOnly: true });
    return json({ runtime: await finalizeExpiredTimedActivityAttempt(user, courseId, groupId, activityId) });
  });
}
