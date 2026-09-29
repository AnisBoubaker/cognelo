import { getServerEnv } from "@cognelo/config";
import { testExecutionRunnerConnection } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ runnerType: string }> }
) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { runnerType } = await context.params;
    return json(await testExecutionRunnerConnection(
      user,
      runnerType,
      getServerEnv().EMAIL_CREDENTIALS_ENCRYPTION_KEY
    ));
  });
}
