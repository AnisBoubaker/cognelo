import { NextRequest } from "next/server";
import { AppError, deleteTestItem, updateTestItem } from "@cognelo/core";
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
    const body = await request.text();
    let input: unknown = {};
    if (body.trim()) {
      try { input = JSON.parse(body); }
      catch { throw new AppError(400, "INVALID_JSON", "The request body must be valid JSON."); }
    }
    return json(await deleteTestItem(user, courseId, activityId, testItemId, input));
  });
}
