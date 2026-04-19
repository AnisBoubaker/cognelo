import { NextRequest } from "next/server";
import { deleteMaterial, updateMaterial } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; materialId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, materialId } = await params;
    return json({ material: await updateMaterial(user, courseId, materialId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, materialId } = await params;
    return json(await deleteMaterial(user, courseId, materialId));
  });
}
