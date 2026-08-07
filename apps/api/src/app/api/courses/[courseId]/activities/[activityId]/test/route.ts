import { NextRequest } from "next/server";
import { runCourseActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { deleteTest, getTestByActivityId, getTestForDeletion, updateTest } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

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

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const test = await getTestForDeletion(user, courseId, activityId);
    for (const item of test.items) {
      await runCourseActivityDeletedHooks({
        user,
        courseId,
        activityId: item.activityId,
        activityTypeKey: item.activity.activityType.key
      });
    }
    return json(await deleteTest(user, courseId, activityId));
  });
}
