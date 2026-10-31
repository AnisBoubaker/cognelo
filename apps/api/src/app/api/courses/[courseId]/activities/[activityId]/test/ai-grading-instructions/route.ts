import type { NextRequest } from "next/server";
import { getTestAiGradingInstructions, replaceTestAiGradingInstructions } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export function OPTIONS() { return options(); }
export function GET(_request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, activityId } = await params;
  return json(await getTestAiGradingInstructions(user, { scope: "course", ownerId: courseId, activityId }));
}); }
export function PUT(request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, activityId } = await params;
  return json(await replaceTestAiGradingInstructions(user, { scope: "course", ownerId: courseId, activityId }, await readJson(request)));
}); }
