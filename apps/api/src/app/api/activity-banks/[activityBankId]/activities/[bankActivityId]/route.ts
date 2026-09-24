import { NextRequest } from "next/server";
import { runBankActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { deleteBankActivity, getBankActivity, updateBankActivity } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    return json({ activity: await getBankActivity(user, activityBankId, bankActivityId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { bankActivityId } = await params;
    return json({ activity: await updateBankActivity(user, bankActivityId, await readJson(request)) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const result = await deleteBankActivity(user, activityBankId, bankActivityId, await readJson(request));
    const deletedActivities = result.deletedActivities ?? [{
      bankActivityId: result.bankActivityId,
      activityTypeKey: result.activityTypeKey
    }];
    await Promise.all(deletedActivities.map((deleted) =>
      runBankActivityDeletedHooks({ user, activityBankId, ...deleted })
    ));
    return json({ ok: true, courseCount: result.courseCount });
  });
}
