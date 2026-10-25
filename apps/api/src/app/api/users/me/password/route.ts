import { UserPasswordChangeSchema } from "@cognelo/contracts";
import { getServerEnv } from "@cognelo/config";
import type { NextRequest } from "next/server";
import { changeMyPassword, loginWithPassword, consumeRateLimits, clearRateLimit } from "@cognelo/core";
import { authCookie, handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser({ allowPasswordChangeRequired: true, allowEmailVerificationRequired: true });
    await consumeRateLimits([{ scope: "password-change", subject: user.id, limit: 10, windowMs: 15 * 60_000 }]);
    const input = UserPasswordChangeSchema.parse(await readJson(request));
    const result = await changeMyPassword(user, input);
    const session = await loginWithPassword(user.email, input.newPassword, getServerEnv().JWT_SECRET);
    await clearRateLimit("password-change", user.id);
    const response = json(result);
    response.cookies.set(authCookie(session.token));
    return response;
  });
}
