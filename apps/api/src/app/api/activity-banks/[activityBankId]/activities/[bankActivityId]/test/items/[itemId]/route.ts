import { NextRequest } from "next/server";
import { deleteBankTestItem, updateBankTestItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string; itemId: string }> };

export function OPTIONS() { return options(); }

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId, itemId } = await params;
    return json({ item: await updateBankTestItem(user, activityBankId, bankActivityId, itemId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId, itemId } = await params;
    await deleteBankTestItem(user, activityBankId, bankActivityId, itemId);
    return json({ ok: true });
  });
}
