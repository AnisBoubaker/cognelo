import { NextRequest } from "next/server";
import { runCourseActivityCreatedFromBankVersionHooks, runCourseActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { createTestItem, deleteTestItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const created = await createTestItem(user, courseId, activityId, await readJson(request));
    const child = created.activity;
    try {
      if (child.bankActivityId && child.activityVersionId) {
        await runCourseActivityCreatedFromBankVersionHooks({
          user,
          courseId,
          bankActivityId: child.bankActivityId,
          activityVersionId: child.activityVersionId,
          activity: {
            id: child.id,
            bankActivityId: child.bankActivityId,
            activityVersionId: child.activityVersionId,
            title: child.title,
            description: child.description,
            lifecycle: child.lifecycle,
            config: (child.config as Record<string, unknown> | null) ?? undefined,
            metadata: (child.metadata as Record<string, unknown> | null) ?? undefined,
            activityType: child.activityType
          }
        });
      }
    } catch (error) {
      await runCourseActivityDeletedHooks({ user, courseId, activityId: child.id, activityTypeKey: child.activityType.key }).catch(() => undefined);
      await deleteTestItem(user, courseId, activityId, created.item.id).catch(() => undefined);
      throw error;
    }
    return json({ item: created.item }, { status: 201 });
  });
}
