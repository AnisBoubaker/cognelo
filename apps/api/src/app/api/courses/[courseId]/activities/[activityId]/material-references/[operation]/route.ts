import type { NextRequest } from "next/server";
import { AppError, finishActivityMaterialReferencePreparation, prepareActivityReferenceMaterial, getActivityMaterialReferencePreview } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string; activityId: string; operation: string }> };
export function OPTIONS() { return options(); }
export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { operation, ...ids } = await params, user = await requireUser();
    if (operation !== "preview") throw new AppError(404, "ROUTE_NOT_FOUND", "Reference action not found.");
    return json(await getActivityMaterialReferencePreview({ user, ...ids }, Object.fromEntries(new URL(request.url).searchParams)));
  });
}
export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const { operation, ...ids } = await params, user = await requireUser(), input = await readJson(request);
    if (operation === "prepare-material") return json(await prepareActivityReferenceMaterial({ user, ...ids }, input, request.signal));
    if (operation === "prepare") return json(await finishActivityMaterialReferencePreparation({ user, ...ids }, input));
    throw new AppError(404, "ROUTE_NOT_FOUND", "Reference action not found.");
  });
}
