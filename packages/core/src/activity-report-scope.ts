import { prisma } from "@cognelo/db";
import type { CurrentUser } from "@cognelo/contracts";
import type { GradebookActionContext } from "@cognelo/activity-sdk/server";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { assertCanViewCourseGradebook } from "./authorization";
import { AppError, forbidden, notFound } from "./errors";

export async function activityReportScope(user: CurrentUser, courseId: string, activityId: string, groupId?: string, participantId?: string): Promise<GradebookActionContext> {
  const permissions = await assertCanViewCourseGradebook(user, courseId);
  if (groupId && permissions.gradingGroupIds !== null && !permissions.gradingGroupIds.includes(groupId)) throw forbidden();
  const activity = await prisma.activity.findFirst({ where: { id: activityId, courseId }, include: { activityType: true } });
  if (!activity) throw notFound("Activity");
  if (groupId && !await prisma.courseGroup.findFirst({ where: { id: groupId, courseId }, select: { id: true } })) throw notFound("Section");
  const provider = getActivityDefinition(activity.activityType.key)?.provider;
  if (provider?.kind === "plugin") {
    const installation = await prisma.activityPluginInstallation.findUnique({ where: { key: provider.key }, select: { isActivated: true } });
    if (!installation?.isActivated) throw new AppError(409, "ACTIVITY_REPORT_UNAVAILABLE", "This activity's provider is inactive.");
  }
  const roster = await prisma.courseGroupParticipant.findMany({ where: {
    role: "student", ...(participantId ? { id: participantId } : {}), group: { courseId, activities: { some: { activityId } } },
    ...(groupId ? { groupId } : permissions.gradingGroupIds !== null ? { groupId: { in: permissions.gradingGroupIds } } : {})
  }, select: { id: true, userId: true, groupId: true, firstName: true, lastName: true, email: true,
    user: { select: { name: true, firstName: true, lastName: true, email: true } }, group: { select: { title: true } } } });
  if (participantId && !roster.length) throw forbidden();
  return { user, courseId, activity: { ...activity, config: activity.config as Record<string, unknown>, metadata: activity.metadata as Record<string, unknown> },
    participants: roster.map(person => ({ participantId: person.id, groupId: person.groupId, userId: person.userId, groupTitle: person.group.title,
      name: [person.user?.firstName, person.user?.lastName].filter(Boolean).join(" ") || person.user?.name || [person.firstName, person.lastName].filter(Boolean).join(" ") || person.user?.email || person.email })) };
}
