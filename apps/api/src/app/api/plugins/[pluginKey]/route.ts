import type { NextRequest } from "next/server";
import { updateActivityPluginInstallation } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ pluginKey: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const input = await readJson(request);
    const { pluginKey } = await params;
    return json({ plugin: await updateActivityPluginInstallation(user, pluginKey, input) });
  });
}
