import { NextRequest } from "next/server";
import { assertCanManageCourse, deleteTestItem, updateTestItem } from "@cognelo/core";
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

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId, testItemId } = await params;
    await assertCanManageCourse(user, courseId);
    const input = await readJson(request, undefined, { allowEmpty: true });
    return json(await deleteTestItem(user, courseId, activityId, testItemId, input));
  });
}
