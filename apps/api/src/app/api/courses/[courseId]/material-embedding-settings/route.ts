import type { NextRequest } from "next/server";
import { getCourseMaterialEmbeddingSettings, updateCourseMaterialEmbeddingSettings } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
type Params = { params: Promise<{ courseId: string }> };
export function OPTIONS() { return options(); }
export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => json(await getCourseMaterialEmbeddingSettings(await requireUser(), (await params).courseId)));
}
export async function PUT(request: NextRequest, { params }: Params) {
  return handleRoute(async () => json(await updateCourseMaterialEmbeddingSettings(await requireUser(), (await params).courseId, await readJson(request))));
}
