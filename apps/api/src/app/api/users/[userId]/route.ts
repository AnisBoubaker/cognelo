import { updateUser } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() { return options(); }

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  return handleRoute(async () => {
    const currentUser = await requireUser();
    const { userId } = await context.params;
    return json({ user: await updateUser(currentUser, userId, await readJson(request)) });
  });
}
