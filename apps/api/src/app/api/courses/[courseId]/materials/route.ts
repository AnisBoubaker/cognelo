import { NextRequest } from "next/server";
import { createMaterial, listMaterials } from "@cognara/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ materials: await listMaterials(user, courseId) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ material: await createMaterial(user, courseId, await readJson(request)) }, { status: 201 });
  });
}
