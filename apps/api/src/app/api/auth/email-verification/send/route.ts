import { consumeRateLimits } from "@cognelo/core";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { requestEmailVerification } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser({ allowPasswordChangeRequired: true, allowEmailVerificationRequired: true });
    const env = getServerEnv();
    await consumeRateLimits([{ scope: "email-verification-send", subject: user.id, limit: 5, windowMs: 60 * 60_000 }]);
    return json(await requestEmailVerification(user, await readJson(request), env.EMAIL_CREDENTIALS_ENCRYPTION_KEY));
  });
}
