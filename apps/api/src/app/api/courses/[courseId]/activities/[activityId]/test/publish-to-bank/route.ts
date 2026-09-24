import { NextRequest } from "next/server";
import { runBankActivityDeletedHooks, runCourseActivityPublishedToBankHooks } from "@cognelo/activity-sdk/server";
import {
  createBankTestFromCourse,
  deleteBankActivity,
  linkCourseTestToPublishedBankCopy,
  updateBankTest
} from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; activityId: string }> };

export function OPTIONS() { return options(); }

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, activityId } = await params;
    const input = await readJson(request) as { activityBankId?: string; title?: string };
    const draft = await createBankTestFromCourse(user, courseId, activityId, input);
    const activityBankId = draft.test.activity.bankId;
    try {
      const published = await updateBankTest(user, activityBankId, draft.test.bankActivityId, { lifecycle: "published" });
      const itemLinks = [];
      for (const copy of draft.activityCopies) {
        const publishedItem = published.items.find((item) => item.bankActivityId === copy.bankActivity.id);
        const version = publishedItem?.activity.currentVersion;
        if (!publishedItem || !version) throw new Error("The reusable Test child version was not created.");
        await runCourseActivityPublishedToBankHooks({
          user,
          courseId,
          bankActivityId: copy.bankActivity.id,
          activityVersionId: version.id,
          activity: {
            id: copy.sourceActivity.id,
            bankActivityId: copy.bankActivity.id,
            activityVersionId: version.id,
            title: copy.sourceActivity.title,
            description: copy.sourceActivity.description,
            lifecycle: copy.sourceActivity.lifecycle,
            config: (copy.sourceActivity.config as Record<string, unknown> | null) ?? undefined,
            metadata: (copy.sourceActivity.metadata as Record<string, unknown> | null) ?? undefined,
            activityType: copy.sourceActivity.activityType
          }
        });
        itemLinks.push({
          sourceActivityId: copy.sourceActivity.id,
          bankActivityId: copy.bankActivity.id,
          activityVersionId: version.id,
          versionNumber: version.versionNumber
        });
      }
      const shellVersion = published.activity.currentVersion;
      if (!shellVersion) throw new Error("The reusable Test version was not created.");
      await linkCourseTestToPublishedBankCopy(user, courseId, activityId, {
        bankActivityId: published.bankActivityId,
        activityVersionId: shellVersion.id,
        versionNumber: shellVersion.versionNumber,
        items: itemLinks
      });
      return json({ test: published }, { status: 201 });
    } catch (error) {
      const deleted = await deleteBankActivity(user, activityBankId, draft.test.bankActivityId, { force: true }).catch(() => null);
      for (const activity of deleted?.deletedActivities ?? []) {
        await runBankActivityDeletedHooks({ user, activityBankId, ...activity }).catch(() => undefined);
      }
      throw error;
    }
  });
}
