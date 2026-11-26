import type { NextRequest } from "next/server";
import { forbidden, getStudentCourseExportPolicy, isAdmin, readBoundedJson, updateStudentCourseExportPolicy } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

export function OPTIONS() { return options(); }
export function GET() { return handleRoute(async () => { await requireUser(); return json(await getStudentCourseExportPolicy()); }); }
export function PUT(request: NextRequest) { return handleRoute(async () => {
  const user = await requireUser();
  if (!isAdmin(user)) throw forbidden();
  return json(await updateStudentCourseExportPolicy(user, await readBoundedJson(request, 100_000)));
}); }
