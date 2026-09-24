import { NextRequest } from "next/server";
import { runBankActivityDeletedHooks, runBankActivityDuplicatedHooks } from "@cognelo/activity-sdk/server";
import { createBankTestItem, discardBankTestItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    const created = await createBankTestItem(user, activityBankId, bankActivityId, await readJson(request));
    try {
      if (created.sourceBankActivityId) {
        await runBankActivityDuplicatedHooks({
          user,
          activityBankId,
          sourceBankActivityId: created.sourceBankActivityId,
          bankActivityId: created.activity.id,
          activityTypeKey: created.activity.activityType.key
        });
      }
    } catch (error) {
      const deleted = await discardBankTestItem(user, activityBankId, bankActivityId, created.item.id).catch(() => null);
      if (deleted) await runBankActivityDeletedHooks({ user, activityBankId, ...deleted }).catch(() => undefined);
      throw error;
    }
    return json({ item: created.item }, { status: 201 });
  });
}
