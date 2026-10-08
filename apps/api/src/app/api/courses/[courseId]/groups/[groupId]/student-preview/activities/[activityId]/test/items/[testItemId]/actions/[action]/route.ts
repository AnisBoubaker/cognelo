import { resolveStudentPreviewExecutionHandler } from "@cognelo/activity-sdk/server";
import { AppError, getStudentPreviewTestItemActivity } from "@cognelo/core";
import type { NextRequest } from "next/server";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string; testItemId: string; action: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId, activityId, testItemId, action } = await params;
    const activity = await getStudentPreviewTestItemActivity(user, courseId, groupId, activityId, testItemId);
    const handler = resolveStudentPreviewExecutionHandler(activity.activityType.key, action);
    if (!handler) throw new AppError(404, "STUDENT_PREVIEW_ACTION_UNAVAILABLE", "This Test activity does not support that Student view action.");
    return json(await handler({
      user,
      courseId,
      groupId,
      activity: {
        ...activity,
        config: (activity.config as Record<string, unknown> | null) ?? undefined,
        metadata: (activity.metadata as Record<string, unknown> | null) ?? undefined
      },
      payload: await readJson(request)
    }));
  });
}
