import { NextRequest } from "next/server";
import { createActivityBank, listActivityBanks } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const subjectId = request.nextUrl.searchParams.get("subjectId") ?? undefined;
    return json({ activityBanks: await listActivityBanks(user, subjectId) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ activityBank: await createActivityBank(user, await readJson(request)) }, { status: 201 });
  });
}
