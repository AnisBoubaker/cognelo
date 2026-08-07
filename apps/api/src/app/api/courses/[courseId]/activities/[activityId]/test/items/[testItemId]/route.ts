import { NextRequest } from "next/server";
import { runCourseActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { deleteTestItem, getTestItemForDeletion, updateTestItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string; testItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId, testItemId } = await params;
    return json({ item: await updateTestItem(user, courseId, activityId, testItemId, await readJson(request)) });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId, testItemId } = await params;
    const item = await getTestItemForDeletion(user, courseId, activityId, testItemId);
    await runCourseActivityDeletedHooks({
      user,
      courseId,
      activityId: item.activityId,
      activityTypeKey: item.activity.activityType.key
    });
    return json(await deleteTestItem(user, courseId, activityId, testItemId));
  });
}
