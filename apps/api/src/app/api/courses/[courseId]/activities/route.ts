import { NextRequest } from "next/server";
import { runCourseActivityCreatedFromBankVersionHooks } from "@cognelo/activity-sdk/server";
import { createActivity, listActivities } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ activities: await listActivities(user, courseId) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const activity = await createActivity(user, courseId, await readJson(request));
    if (activity.bankActivityId && activity.activityVersionId) {
      await runCourseActivityCreatedFromBankVersionHooks({
        user,
        courseId,
        bankActivityId: activity.bankActivityId,
        activityVersionId: activity.activityVersionId,
        activity: {
          id: activity.id,
          bankActivityId: activity.bankActivityId,
          activityVersionId: activity.activityVersionId,
          title: activity.title,
          description: activity.description,
          lifecycle: activity.lifecycle,
          config: (activity.config as Record<string, unknown> | null) ?? undefined,
          metadata: (activity.metadata as Record<string, unknown> | null) ?? undefined,
          activityType: {
            key: activity.activityType.key,
            name: activity.activityType.name,
            description: activity.activityType.description
          }
        }
      });
    }
    return json({ activity }, { status: 201 });
  });
}
