import type { NextRequest } from "next/server";
import { getAiGradingRun, actOnAiGradingRun } from "@cognelo/core";
import { AiGradingRunActionSchema } from "@cognelo/contracts";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; runId: string }> };
export function OPTIONS() { return options(); }
export function GET(_request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, runId } = await params;
  return json({ run: await getAiGradingRun(user, courseId, runId) });
}); }
export function PATCH(request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, runId } = await params;
  return json({ run: await actOnAiGradingRun(user, courseId, runId, AiGradingRunActionSchema.parse(await readJson(request)).action) });
}); }
