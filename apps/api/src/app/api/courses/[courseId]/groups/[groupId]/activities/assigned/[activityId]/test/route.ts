import { NextRequest } from "next/server";
import { getTestRuntime, startOrResumeTestAttempt } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    const view = new URL(request.url).searchParams.get("view") === "previous" ? "previous" : "attempt";
    return json({ runtime: await getTestRuntime(user, courseId, groupId, activityId, view) });
  });
}

export async function POST(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId } = await params;
    return json({ runtime: await startOrResumeTestAttempt(user, courseId, groupId, activityId) }, { status: 201 });
  });
}
