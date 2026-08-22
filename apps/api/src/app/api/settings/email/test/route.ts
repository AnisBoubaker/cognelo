import { getServerEnv } from "@cognelo/config";
import { sendEmailDeliveryTest } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    const env = getServerEnv();
    return json(await sendEmailDeliveryTest(user, input, env.EMAIL_CREDENTIALS_ENCRYPTION_KEY));
  });
}
