import { NextRequest } from "next/server";
import { archiveCourse, getCourse, updateCourse } from "@cognara/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ course: await getCourse(user, courseId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ course: await updateCourse(user, courseId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ course: await archiveCourse(user, courseId) });
  });
}
