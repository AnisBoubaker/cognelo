import { NextRequest } from "next/server";
import { runCourseActivityDeletedHooks, runCourseActivityDuplicatedHooks } from "@cognelo/activity-sdk/server";
import { deleteActivity, duplicateCourseActivity } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const activity = await duplicateCourseActivity(user, courseId, activityId, await readJson(request));
    try {
      await runCourseActivityDuplicatedHooks({
        user,
        courseId,
        sourceActivityId: activityId,
        activity: {
          id: activity.id,
          bankActivityId: activity.bankActivityId,
          activityVersionId: activity.activityVersionId,
          title: activity.title,
          description: activity.description,
          lifecycle: activity.lifecycle,
          config: (activity.config as Record<string, unknown> | null) ?? undefined,
          metadata: (activity.metadata as Record<string, unknown> | null) ?? undefined,
          activityType: activity.activityType
        }
      });
    } catch (error) {
      await runCourseActivityDeletedHooks({ user, courseId, activityId: activity.id, activityTypeKey: activity.activityType.key }).catch(() => undefined);
      await deleteActivity(user, courseId, activity.id).catch(() => undefined);
      throw error;
    }
    return json({ activity }, { status: 201 });
  });
}
