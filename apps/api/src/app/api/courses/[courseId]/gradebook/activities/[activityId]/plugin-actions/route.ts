import { NextRequest } from "next/server";
import { assertCanViewCourseGradebook, executeGradebookPluginAction, listGradebookPluginActions } from "@cognelo/core";
import { z } from "zod";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export const runtime = "nodejs";
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => { const user = await requireUser(), { courseId, activityId } = await params;
    return json(await listGradebookPluginActions(user, courseId, activityId, request.nextUrl.searchParams.get("groupId") || undefined)); });
}
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => { const user = await requireUser(), { courseId, activityId } = await params;
    await assertCanViewCourseGradebook(user, courseId);
    const { actionId, ...input } = z.object({ actionId: z.string().min(1).max(64), participantId: z.string().min(1).optional(), groupId: z.string().min(1).optional() }).strict().parse(await readJson(request, 8192));
    return json(await executeGradebookPluginAction(user, courseId, activityId, actionId, input, request.signal), { headers: { "Access-Control-Expose-Headers": "Content-Disposition" } }); });
}
