import { runBankActivityDeletedHooks, runBankActivityDuplicatedHooks } from "@cognelo/activity-sdk/server";
import { deleteBankActivity, duplicateBankActivity, duplicateBankTest, findBankTestByShellActivityId } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const input = await readJson(request);
    if (await findBankTestByShellActivityId(bankActivityId)) {
      const result = await duplicateBankTest(user, activityBankId, bankActivityId, input);
      try {
        for (const copy of result.activityCopies) {
          await runBankActivityDuplicatedHooks({
            user,
            activityBankId,
            sourceBankActivityId: copy.sourceBankActivityId,
            bankActivityId: copy.bankActivity.id,
            activityTypeKey: copy.bankActivity.activityType.key
          });
        }
      } catch (error) {
        const deleted = await deleteBankActivity(user, activityBankId, result.test.bankActivityId, { force: true }).catch(() => null);
        for (const activity of deleted?.deletedActivities ?? []) {
          await runBankActivityDeletedHooks({ user, activityBankId, ...activity }).catch(() => undefined);
        }
        throw error;
      }
      return json({ activity: result.test.activity }, { status: 201 });
    }
    const activity = await duplicateBankActivity(user, activityBankId, bankActivityId, input);
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
