import { NextRequest } from "next/server";
import { createPluginContentResource, listContentResources } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    return json({ resources: await listContentResources(user, courseId, { groupId }) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    const body = (await readJson(request)) as Parameters<typeof createPluginContentResource>[2];
    const result = await createPluginContentResource(user, courseId, { ...body, groupId });
    return json(result, { status: 201 });
  });
}
