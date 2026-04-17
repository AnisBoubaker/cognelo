import { NextRequest } from "next/server";
import { createCourse, listCourses } from "@cognara/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ courses: await listCourses(user) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ course: await createCourse(user, await readJson(request)) }, { status: 201 });
  });
}
