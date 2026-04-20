import { NextRequest } from "next/server";
import { deleteGroupMaterial, updateGroupMaterial } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; materialId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, materialId } = await params;
    return json({ material: await updateGroupMaterial(user, courseId, groupId, materialId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, materialId } = await params;
    return json(await deleteGroupMaterial(user, courseId, groupId, materialId));
  });
}
