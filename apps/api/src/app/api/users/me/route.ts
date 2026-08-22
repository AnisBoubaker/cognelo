import { getMe, updateMyProfile } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser({ allowPasswordChangeRequired: true, allowEmailVerificationRequired: true });
    return json({ user: await getMe(user) });
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    return json({ user: await updateMyProfile(user, input) });
  });
}
