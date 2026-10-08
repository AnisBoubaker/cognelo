import { runCourseActivityDeletedHooks } from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import {
  AppError,
  deleteActivity,
  deleteTest,
  getActivityDeletionImpact,
  getActivityForDeletion,
  getTestForDeletion,
  type CourseContentDeletionActivity
} from "@cognelo/core";

type ActivityDeletionHookTarget = Pick<
  CourseContentDeletionActivity,
  "activityId" | "activityTypeKey" | "isTest" | "testItems"
>;

export async function runCourseActivityDeletionHooks(
  user: CurrentUser,
  courseId: string,
  activity: ActivityDeletionHookTarget
) {
  if (activity.isTest) {
    for (const item of activity.testItems) {
      await runCourseActivityDeletedHooks({
        user,
        courseId,
        activityId: item.activityId,
        activityTypeKey: item.activityTypeKey
      });
    }
    return;
  }
  await runCourseActivityDeletedHooks({
    user,
    courseId,
    activityId: activity.activityId,
    activityTypeKey: activity.activityTypeKey
  });
}

export async function deleteCourseActivityWithHooks(
  user: CurrentUser,
  courseId: string,
  activityId: string,
  options: { confirmRecordedAttempts?: boolean } = {}
) {
  const impact = await getActivityDeletionImpact(user, courseId, activityId);
  if (impact.recordedAttemptCount > 0 && options.confirmRecordedAttempts !== true) {
    throw new AppError(
      409,
      "ACTIVITY_RECORDED_ATTEMPTS_CONFIRMATION_REQUIRED",
      "This activity has recorded attempts. Confirm their permanent deletion before deleting the activity.",
      impact
    );
  }

  const activity = await getActivityForDeletion(user, courseId, activityId);
  if (activity.testDefinition) {
    const test = await getTestForDeletion(user, courseId, activityId);
    await runCourseActivityDeletionHooks(user, courseId, {
      activityId,
      activityTypeKey: activity.activityType.key,
      isTest: true,
      testItems: test.items.map((item) => ({
        activityId: item.activityId,
        activityTypeKey: item.activity.activityType.key
      }))
    });
    return deleteTest(user, courseId, activityId, options);
  }

  await runCourseActivityDeletionHooks(user, courseId, {
    activityId,
    activityTypeKey: activity.activityType.key,
    isTest: false,
    testItems: []
  });
  return deleteActivity(user, courseId, activityId, options);
}
