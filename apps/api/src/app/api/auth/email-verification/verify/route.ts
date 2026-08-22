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
    return json(await verifyEmailAddress(user, await readJson(request), env.EMAIL_CREDENTIALS_ENCRYPTION_KEY));
  });
}
