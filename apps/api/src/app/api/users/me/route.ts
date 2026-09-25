import { getMe, updateMyProfile } from "@cognelo/core";
import { authCookie, handleRoute, json, options, readJson, refreshUserSession, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const session = await refreshUserSession({ allowPasswordChangeRequired: true, allowEmailVerificationRequired: true });
    const response = json({ user: await getMe(session.user) });
    response.cookies.set(authCookie(session.token));
    return response;
  });
}

export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    return json({ user: await updateMyProfile(user, input) });
  });
}
