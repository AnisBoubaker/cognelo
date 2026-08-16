import { runBankActivityDuplicatedHooks } from "@cognelo/activity-sdk/server";
import { duplicateBankActivity } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const activity = await duplicateBankActivity(user, activityBankId, bankActivityId, await readJson(request));
    await runBankActivityDuplicatedHooks({
      user,
      activityBankId,
      sourceBankActivityId: bankActivityId,
      bankActivityId: activity.id,
      activityTypeKey: activity.activityType.key
    });
    return json({ activity }, { status: 201 });
  });
}
