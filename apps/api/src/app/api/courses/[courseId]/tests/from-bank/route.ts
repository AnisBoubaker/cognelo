import { NextRequest } from "next/server";
import { runCourseActivityCreatedFromBankVersionHooks, runCourseActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import { createCourseTestFromBankVersion, deleteTest } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const result = await createCourseTestFromBankVersion(user, courseId, await readJson(request));
    try {
      for (const copy of result.activityCopies) {
        await runCourseActivityCreatedFromBankVersionHooks({
          user,
          courseId,
          bankActivityId: copy.bankActivityId,
          activityVersionId: copy.activityVersionId,
          activity: {
            id: copy.activity.id,
            bankActivityId: copy.bankActivityId,
            activityVersionId: copy.activityVersionId,
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
      for (const copy of result.activityCopies) {
        await runCourseActivityDeletedHooks({
          user,
          courseId,
          activityId: copy.activity.id,
          activityTypeKey: copy.activity.activityType.key
        }).catch(() => undefined);
      }
      await deleteTest(user, courseId, result.test.activityId).catch(() => undefined);
      throw error;
    }
    return json({ test: result.test }, { status: 201 });
  });
}
