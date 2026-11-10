import { getUserProfilePolicy, updateUserProfilePolicy } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() { return options(); }

// The only exposed setting is the current user's self-service name policy.
export async function GET() {
  return handleRoute(async () => {
    await requireUser();
    return json(await getUserProfilePolicy());
  });
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => json(await updateUserProfilePolicy(await requireUser(), await readJson(request))));
}
