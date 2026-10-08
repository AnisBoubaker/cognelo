import type { CurrentUser } from "@cognelo/contracts";
import { prisma } from "@cognelo/db";
import { assertCanPreviewGroupAsStudent } from "./authorization";
import { listContentItems } from "./course-content";
import { notFound } from "./errors";
import { getGroupAssignedActivityForStudentPreview } from "./groups";

export async function getStudentPreviewWorkspace(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanPreviewGroupAsStudent(user, courseId, groupId);
  const [course, group] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, description: true, status: true, metadata: true, materials: true }
    }),
    prisma.courseGroup.findFirst({
      where: { id: groupId, courseId },
      select: {
        id: true,
        title: true,
        status: true,
        availableFrom: true,
        availableUntil: true,
        materials: true,
        activities: {
          include: { activity: { include: { activityType: true } } },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }]
        }
      }
    })
  ]);
  if (!course) throw notFound("Course");
  if (!group) throw notFound("Course group");

  const now = new Date();
  const isAvailable = group.status === "published"
    && (!group.availableFrom || group.availableFrom <= now)
    && (!group.availableUntil || group.availableUntil >= now);
  const visibleContentItems = isAvailable
    ? await listContentItems(user, courseId, { groupId, visibleOnly: true })
    : [];
  const contentItems = visibleContentItems.filter(
    (item) => item.kind !== "activity" || Boolean(item.courseGroupActivityId)
  );

  return { course, group, contentItems, isAvailable };
}

export async function getStudentPreviewTestRuntime(user: CurrentUser, courseId: string, groupId: string, activityId: string) {
  const assignedActivity = await getGroupAssignedActivityForStudentPreview(user, courseId, groupId, activityId);
  if (assignedActivity.activityType.key !== "test") throw notFound("Test");
  const test = await prisma.test.findFirst({
    where: { courseId, activityId },
    include: {
      activity: { include: { activityType: true, bankActivity: true, activityVersion: true } },
      items: {
        include: { activity: { include: { activityType: true, bankActivity: true, activityVersion: true } } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!test) throw notFound("Test");
  return {
    test: { ...test, items: test.items.map((item) => ({ ...item, itemAttempt: null })) },
    attempt: null,
    timing: { timeLimitMinutes: readTimeLimitMinutes(test.settings), expiresAt: null, remainingSeconds: null, isExpired: false },
    resume: { allowed: true, blocked: false },
    availability: { canStart: true, reason: null, attemptsRemaining: null },
    hasPreviousSubmissions: false
  };
}

export async function getStudentPreviewTestItemActivity(
  user: CurrentUser,
  courseId: string,
  groupId: string,
  testActivityId: string,
  testItemId: string
) {
  await getGroupAssignedActivityForStudentPreview(user, courseId, groupId, testActivityId);
  const item = await prisma.testItem.findFirst({
    where: { id: testItemId, test: { courseId, activityId: testActivityId } },
    include: { activity: { include: { activityType: true } } }
  });
  if (!item) throw notFound("Test item");
  return item.activity;
}

function readTimeLimitMinutes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = (value as Record<string, unknown>).timeLimitMinutes;
  return typeof result === "number" && Number.isFinite(result) && result > 0 ? result : null;
}
