import { NextRequest } from "next/server";
import { runCourseActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { deleteActivity, deleteTest, getActivity, getActivityForDeletion, getTestForDeletion, updateActivity } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ activity: await getActivity(user, courseId, activityId) });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ activity: await updateActivity(user, courseId, activityId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const activity = await getActivityForDeletion(user, courseId, activityId);
    if (activity.testDefinition) {
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
    }
    await runCourseActivityDeletedHooks({
      user,
      courseId,
      activityId,
      activityTypeKey: activity.activityType.key
    });
    return json(await deleteActivity(user, courseId, activityId));
  });
}
