import { NextRequest } from "next/server";
import { assignActivityToAllCourseGroups, removeActivityFromAllCourseGroupsPolicy } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json(
      { activity: await assignActivityToAllCourseGroups(user, courseId, activityId, await readJson(request)) },
      { status: 201 }
    );
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ activity: await removeActivityFromAllCourseGroupsPolicy(user, courseId, activityId) });
  });
}
