import { consumeRateLimits } from "@cognelo/core";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { verifyEmailAddress } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser({ allowPasswordChangeRequired: true, allowEmailVerificationRequired: true });
    const env = getServerEnv();
    await consumeRateLimits([{ scope: "email-verification-verify", subject: user.id, limit: 30, windowMs: 60 * 60_000 }]);
    return json(await verifyEmailAddress(user, await readJson(request), env.EMAIL_CREDENTIALS_ENCRYPTION_KEY));
  });
}
