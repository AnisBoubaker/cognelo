import { NextRequest } from "next/server";
import { updateContentTypePluginInstallation } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ pluginKey: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { pluginKey } = await params;
    return json({ plugin: await updateContentTypePluginInstallation(user, pluginKey, await readJson(request)) });
  });
}
