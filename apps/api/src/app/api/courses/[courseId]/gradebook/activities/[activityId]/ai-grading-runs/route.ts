import type { NextRequest } from "next/server";
import { createAiGradingRun, getPendingAiGradingRun, getActivityAiGradingActions } from "@cognelo/core";
import { AiGradingRunCreateSchema } from "@cognelo/contracts";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export function OPTIONS() { return options(); }
export function GET(request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, activityId } = await params;
  const [run, actions] = await Promise.all([getPendingAiGradingRun(user, courseId, activityId),
    getActivityAiGradingActions(user, courseId, activityId, request.nextUrl.searchParams.get("groupId") || undefined)]);
  return json({ run, actions });
}); }
export function POST(request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, activityId } = await params;
  return json({ run: await createAiGradingRun(user, courseId, activityId, AiGradingRunCreateSchema.parse(await readJson(request))) });
}); }
