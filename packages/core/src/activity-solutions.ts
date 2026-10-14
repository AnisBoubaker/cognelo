import { getActivityDefinition, type ActivitySolution } from "@cognelo/activity-sdk";
import { resolvePluginStudentSolutionHandler, type ServerActivityRecord } from "@cognelo/activity-sdk/server";
import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { assignmentAssessmentPolicyMode, courseActivitySolutionReleased } from "./activity-assignment-policy";
import { AppError, forbidden } from "./errors";
import { getGroupAssignedActivity } from "./groups";
import { isActivityTypeAvailable } from "./plugins";

async function solutionContext(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  const participant = await prisma.courseGroupParticipant.findFirst({
    where: { groupId, userId: user.id, role: "student", group: { courseId } }, select: { id: true }
  });
  if (!participant) throw forbidden();
  const typeKey = activity.activityType.key;
  const supported = getActivityDefinition(typeKey)?.supportsSolution === true
    && (typeKey === "test" || Boolean(resolvePluginStudentSolutionHandler(typeKey)))
    && await isActivityTypeAvailable(typeKey);
  let available = supported && courseActivitySolutionReleased(activity.metadata);
  if (available && (activity.activityType.key === "test" || assignmentAssessmentPolicyMode(activity.assignment.metadata) === "summative")) {
    const item = await prisma.gradebookItem.findFirst({
      where: { courseId, groupId, activityId, groupActivityId: activity.assignment.id },
      select: { gradesReleased: true }
    });
    available = item?.gradesReleased === true;
  }
  return { activity, available };
}

/** Metadata only. Never preload the reference solution into the learner page. */
export async function getActivitySolutionAvailability(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const { available } = await solutionContext(user, courseId, groupId, activityId);
  return { available };
}

/** Every explicit reveal rechecks enrollment, assignment access, policy, and grade release. */
export async function getActivitySolution(user: CurrentUser, courseId: string, groupId: string, activityId: string): Promise<ActivitySolution> {
  const { activity, available } = await solutionContext(user, courseId, groupId, activityId);
  if (!available) throw new AppError(403, "ACTIVITY_SOLUTION_NOT_RELEASED", "The solution is not available.");
  const activities = activity.activityType.key === "test"
    ? (await prisma.testItem.findMany({
      where: { test: { courseId, activityId }, removedAt: null },
      include: { activity: { include: { activityType: true } } }, orderBy: [{ position: "asc" }, { id: "asc" }]
    })).map((item) => item.activity)
    : [activity];
  const solutions = await Promise.all(activities.map(async (entry) => {
    if (!getActivityDefinition(entry.activityType.key)?.supportsSolution) return null;
    if (!await isActivityTypeAvailable(entry.activityType.key)) return null;
    const handler = resolvePluginStudentSolutionHandler(entry.activityType.key);
    if (!handler) return null;
    const content = await handler({ ...entry, config: record(entry.config), metadata: record(entry.metadata) } as ServerActivityRecord);
    return content ? { id: entry.id, title: entry.title, content } : null;
  }));
  return { activities: solutions.filter((entry) => entry !== null) };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
