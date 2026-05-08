import { updateCourseSettings } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const input = await readJson(request);
    return json({ course: await updateCourseSettings(user, courseId, input) });
  });
}
