import { NextRequest } from "next/server";
import { runBankActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { deleteActivityBank, getActivityBank, updateActivityBank } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId } = await params;
    return json({ activityBank: await getActivityBank(user, activityBankId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId } = await params;
    return json({ activityBank: await updateActivityBank(user, activityBankId, await readJson(request)) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId } = await params;
    const result = await deleteActivityBank(user, activityBankId, await readJson(request));
    for (const activity of result.deletedActivities) {
      await runBankActivityDeletedHooks({ user, activityBankId, ...activity });
    }
    return json({ ok: true, activityCount: result.activityCount });
  });
}
