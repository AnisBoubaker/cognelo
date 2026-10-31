import type { NextRequest } from "next/server";
import { processAiGradingRunAttempt } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; runId: string; attemptId: string }> };
export function OPTIONS() { return options(); }
export function POST(_request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { courseId, runId, attemptId } = await params;
  return json({ run: await processAiGradingRunAttempt(user, courseId, runId, attemptId) });
}); }
