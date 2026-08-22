import { getEmailDeliveryConfiguration, updateEmailDeliveryConfiguration } from "@cognelo/core";
import { getServerEnv } from "@cognelo/config";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ configuration: await getEmailDeliveryConfiguration(user) });
  });
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    const env = getServerEnv();
    return json({
      configuration: await updateEmailDeliveryConfiguration(user, input, env.EMAIL_CREDENTIALS_ENCRYPTION_KEY)
    });
  });
}
