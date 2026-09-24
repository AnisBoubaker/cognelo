import { NextRequest } from "next/server";
import { getBankTestByActivityId, updateBankTest } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    return json({ test: await getBankTestByActivityId(user, activityBankId, bankActivityId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    return json({ test: await updateBankTest(user, activityBankId, bankActivityId, await readJson(request)) });
  });
}
