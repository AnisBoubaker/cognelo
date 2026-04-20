import { NextRequest } from "next/server";
import { hideCourseMaterialForGroup, unhideCourseMaterialForGroup } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; materialId: string }> };

export function OPTIONS() {
  return options();
}

export async function PUT(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, materialId } = await params;
    return json(await hideCourseMaterialForGroup(user, courseId, groupId, materialId));
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, materialId } = await params;
    return json(await unhideCourseMaterialForGroup(user, courseId, groupId, materialId));
  });
}
