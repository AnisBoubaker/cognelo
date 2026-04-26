import { NextRequest } from "next/server";
import { createBankActivity, listBankActivities } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId } = await params;
    return json({ activities: await listBankActivities(user, activityBankId) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { activityBankId } = await params;
    return json({ activity: await createBankActivity(user, activityBankId, await readJson(request)) }, { status: 201 });
  });
}
