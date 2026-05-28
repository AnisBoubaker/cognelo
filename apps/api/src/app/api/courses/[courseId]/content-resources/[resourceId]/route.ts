import { NextRequest } from "next/server";
import { deletePluginContentResource, updatePluginContentResource } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; resourceId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, resourceId } = await params;
    return json({ resource: await updatePluginContentResource(user, courseId, resourceId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, resourceId } = await params;
    return json(await deletePluginContentResource(user, courseId, resourceId));
  });
}
