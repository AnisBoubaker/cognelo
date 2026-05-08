import { deleteAiAgentConnection, updateAiAgentConnection } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { connectionId } = await params;
    const input = await readJson(request);
    return json({ connection: await updateAiAgentConnection(user, connectionId, input) });
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ connectionId: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { connectionId } = await params;
    return json(await deleteAiAgentConnection(user, connectionId));
  });
}
