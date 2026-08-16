import { NextRequest } from "next/server";
import { moveBankActivity } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId, bankActivityId } = await params;
    return json({ activity: await moveBankActivity(user, activityBankId, bankActivityId, await readJson(request)) });
  });
}
