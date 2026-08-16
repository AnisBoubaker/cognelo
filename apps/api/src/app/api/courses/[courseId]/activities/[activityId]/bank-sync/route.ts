import { NextRequest } from "next/server";
import { runCourseActivityCreatedFromBankVersionHooks, runCourseActivityPublishedToBankHooks } from "@cognelo/activity-sdk/server";
import { getCourseActivityBankSyncStatus, syncCourseActivityWithBank } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() { return options(); }

export async function GET(_request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    return json({ sync: await getCourseActivityBankSyncStatus(user, courseId, activityId) });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const result = await syncCourseActivityWithBank(user, courseId, activityId, await readJson(request));
    const hookInput = {
      user,
      courseId,
      activity: {
        id: result.activity.id,
        bankActivityId: result.activity.bankActivityId,
        activityVersionId: result.activity.activityVersionId,
        title: result.activity.title,
        description: result.activity.description,
        lifecycle: result.activity.lifecycle,
        config: (result.activity.config as Record<string, unknown> | null) ?? undefined,
        metadata: (result.activity.metadata as Record<string, unknown> | null) ?? undefined,
        activityType: result.activity.activityType
      },
      bankActivityId: result.activity.bankActivityId!,
      activityVersionId: result.version.id
    };
    if (result.action === "publish_to_bank") await runCourseActivityPublishedToBankHooks(hookInput);
    else await runCourseActivityCreatedFromBankVersionHooks(hookInput);
    return json({ activity: result.activity, version: result.version });
  });
}
