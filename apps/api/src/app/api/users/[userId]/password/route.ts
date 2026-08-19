import type { NextRequest } from "next/server";
import { resetUserPassword } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function PUT(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { userId } = await context.params;
    return json(await resetUserPassword(user, userId, await readJson(request)));
  });
}
