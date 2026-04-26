import { NextRequest } from "next/server";
import { updateBankActivity } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ bankActivityId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { bankActivityId } = await params;
    return json({ activity: await updateBankActivity(user, bankActivityId, await readJson(request)) });
  });
}
