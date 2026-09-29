import { getServerEnv } from "@cognelo/config";
import { updateExecutionRunnerConfiguration } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ runnerType: string }> }
) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { runnerType } = await context.params;
    const input = await readJson(request);
    return json({
      configuration: await updateExecutionRunnerConfiguration(
        user,
        runnerType,
        input,
        getServerEnv().EMAIL_CREDENTIALS_ENCRYPTION_KEY
      )
    });
  });
}
