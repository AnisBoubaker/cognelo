import { NextRequest } from "next/server";
import { executeActivityBatchAction, listActivityBatchActions } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => { const user = await requireUser(), { courseId, activityId } = await params;
    return json(await listActivityBatchActions(user, courseId, activityId, request.nextUrl.searchParams.get("groupId") || undefined)); });
}
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => { const user = await requireUser(), { courseId, activityId } = await params;
    return json(await executeActivityBatchAction(user, courseId, activityId, await readJson(request, 8192))); });
}
