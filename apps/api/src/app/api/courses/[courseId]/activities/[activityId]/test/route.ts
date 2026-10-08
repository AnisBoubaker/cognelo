import { NextRequest } from "next/server";
import { getTestByActivityId, updateTest } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { deleteCourseActivityWithHooks } from "@/lib/course-activity-deletion";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ test: await getTestByActivityId(user, courseId, activityId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ test: await updateTest(user, courseId, activityId, await readJson(request)) });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json(await deleteCourseActivityWithHooks(user, courseId, activityId, {
      confirmRecordedAttempts: new URL(request.url).searchParams.get("confirmRecordedAttempts") === "true"
    }));
  });
}
