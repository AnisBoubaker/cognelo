import { getCourseTimeSettings, updateCourseTimeSettings } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

type Context = { params: Promise<{ courseId: string }> };
export function OPTIONS() { return options(); }
export async function GET(_request: NextRequest, { params }: Context) {
  return handleRoute(async () => json(await getCourseTimeSettings(await requireUser(), (await params).courseId), { headers: { "Cache-Control": "no-store" } }));
}
export async function PUT(request: NextRequest, { params }: Context) {
  return handleRoute(async () => json(await updateCourseTimeSettings(await requireUser(), (await params).courseId, await readJson(request))));
}
