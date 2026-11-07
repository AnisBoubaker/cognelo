import type { NextRequest } from "next/server";
import { getActivityMaterialReferences, saveActivityMaterialReferences } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string }> };
export function OPTIONS() { return options(); }
export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => json(await getActivityMaterialReferences({ user: await requireUser(), ...await params })));
}
export async function PUT(request: NextRequest, { params }: Params) {
  return handleRoute(async () => json(await saveActivityMaterialReferences({ user: await requireUser(), ...await params }, await readJson(request))));
}
