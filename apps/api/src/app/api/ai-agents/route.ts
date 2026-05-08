import { createAiAgentConnection, listAiAgentConnections } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json(await listAiAgentConnections(user));
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    return json({ connection: await createAiAgentConnection(user, input) }, { status: 201 });
  });
}
