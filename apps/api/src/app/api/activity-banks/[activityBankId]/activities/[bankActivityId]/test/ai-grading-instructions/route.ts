import type { NextRequest } from "next/server";
import { getTestAiGradingInstructions, replaceTestAiGradingInstructions } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };
export function OPTIONS() { return options(); }
export function GET(_request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { activityBankId, bankActivityId } = await params;
  return json(await getTestAiGradingInstructions(user, { scope: "bank", ownerId: activityBankId, activityId: bankActivityId }));
}); }
export function PUT(request: NextRequest, { params }: Params) { return handleRoute(async () => {
  const user = await requireUser(); const { activityBankId, bankActivityId } = await params;
  return json(await replaceTestAiGradingInstructions(user, { scope: "bank", ownerId: activityBankId, activityId: bankActivityId }, await readJson(request)));
}); }
