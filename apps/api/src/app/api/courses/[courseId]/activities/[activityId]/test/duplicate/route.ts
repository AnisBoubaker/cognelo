import { NextRequest } from "next/server";
import { runCourseActivityDeletedHooks, runCourseActivityDuplicatedHooks } from "@cognelo/activity-sdk/server";
import { deleteTest, duplicateTest } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const duplicated = await duplicateTest(user, courseId, activityId, await readJson(request));
    try {
      for (const copy of duplicated.activityCopies) {
        await runCourseActivityDuplicatedHooks({
          user,
          courseId,
          sourceActivityId: copy.sourceActivityId,
          activity: {
            id: copy.activity.id,
            bankActivityId: copy.activity.bankActivityId,
            activityVersionId: copy.activity.activityVersionId,
            title: copy.activity.title,
            description: copy.activity.description,
            lifecycle: copy.activity.lifecycle,
            config: (copy.activity.config as Record<string, unknown> | null) ?? undefined,
            metadata: (copy.activity.metadata as Record<string, unknown> | null) ?? undefined,
            activityType: copy.activity.activityType
          }
        });
      }
    } catch (error) {
      for (const copy of duplicated.activityCopies) {
        await runCourseActivityDeletedHooks({
          user,
          courseId,
          activityId: copy.activity.id,
          activityTypeKey: copy.activity.activityType.key
        }).catch(() => undefined);
      }
      await deleteTest(user, courseId, duplicated.test.activityId).catch(() => undefined);
      throw error;
    }
    return json({ test: duplicated.test }, { status: 201 });
  });
}
