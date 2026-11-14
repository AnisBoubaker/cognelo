import { prisma } from "@cognelo/db";
import type { ActivityStudentProgress, CurrentUser } from "@cognelo/contracts";
import { assertCanViewCourseGradebook } from "./authorization";
import { forbidden } from "./errors";
import { assignmentAssessmentMode, type CourseActivityInProgressAttempt } from "./gradebook";
import { recoverExpiredTestAttempts } from "./test-timeout-recovery";

/** Lightweight participation feed; never retrieves responses or full grade rows. */
export async function getCourseActivityProgress(user: CurrentUser, courseId: string, activityId: string, groupId?: string | null) {
  const capabilities = await assertCanViewCourseGradebook(user, courseId);
  if (groupId && capabilities.gradingGroupIds !== null && !capabilities.gradingGroupIds.includes(groupId)) throw forbidden();
  const scope = groupId ? { groupId } : capabilities.gradingGroupIds !== null ? { groupId: { in: capabilities.gradingGroupIds } } : {};
  await recoverExpiredTestAttempts({ courseId, activityId, ...scope }, user.id);
  const assignments = await prisma.courseGroupActivity.findMany({
    where: { activityId, group: { courseId }, ...scope },
    select: {
      id: true, groupId: true, metadata: true,
      activity: { select: { metadata: true, activityType: { select: { key: true } } } },
      group: { select: { participants: { where: { role: "student" }, select: { id: true, userId: true } } } }
    }
  });
  const participants = assignments.flatMap(assignment => assignment.group.participants.map(person => ({
    participantId: person.id, groupId: assignment.groupId, userId: person.userId
  })));
  const assignmentIds = assignments.map(assignment => assignment.id);
  const assignmentMetadata = Object.fromEntries(assignments.map(assignment => [assignment.groupId, assignment.metadata]));
  const activityMetadata = assignments[0]?.activity.metadata ?? {};
  if (!assignmentIds.length) return { attempts: [], progress: [], participants, activityTypeKey: "", activityMetadata, assignmentMetadata };
  const [attempts, drafts, conversations] = await Promise.all([
    prisma.activityAttempt.findMany({
      where: { courseId, activityId, groupActivityId: { in: assignmentIds }, lifecycle: { not: "deleted" } },
      select: { participantId: true, groupId: true, groupActivityId: true, lifecycle: true, assessmentMode: true, attemptNumber: true, startedAt: true, submittedAt: true },
      orderBy: [{ attemptNumber: "desc" }, { id: "desc" }]
    }),
    prisma.activityResponseDraft.findMany({ where: { groupActivityId: { in: assignmentIds } }, select: { participantId: true, groupActivityId: true, updatedAt: true } }),
    prisma.activityConversation.findMany({
      where: { courseId, activityId, groupActivityId: { in: assignmentIds }, closedAt: null, lastSeenAt: { gt: new Date(0) } },
      select: { participantId: true, groupActivityId: true, lastSeenAt: true }, orderBy: { lastSeenAt: "desc" }
    })
  ]);
  const key = (assignmentId: string, participantId: string) => `${assignmentId}:${participantId}`;
  const policy = new Map(assignments.map(assignment => [assignment.id, assignmentAssessmentMode(assignment.metadata)]));
  const latest = new Map<string, typeof attempts[number]>();
  for (const attempt of attempts) {
    if (attempt.assessmentMode !== policy.get(attempt.groupActivityId)) continue;
    const id = key(attempt.groupActivityId, attempt.participantId);
    if (!latest.has(id)) latest.set(id, attempt);
  }
  const draftByPerson = new Map(drafts.map(draft => [key(draft.groupActivityId, draft.participantId), draft.updatedAt]));
  const presenceByPerson = new Map<string, Date>();
  for (const presence of conversations) {
    const id = key(presence.groupActivityId, presence.participantId);
    if (!presenceByPerson.has(id)) presenceByPerson.set(id, presence.lastSeenAt);
  }
  const progress: ActivityStudentProgress[] = assignments.flatMap(assignment => assignment.group.participants.map(person => {
    const id = key(assignment.id, person.id), attempt = latest.get(id);
    const submittedAt = attempt?.submittedAt?.getTime() ?? 0;
    const working = attempt?.lifecycle === "started"
      || (draftByPerson.get(id)?.getTime() ?? 0) > submittedAt
      // A heartbeat alone must not turn a completed submission back into work.
      || (!attempt && (presenceByPerson.get(id)?.getTime() ?? 0) > 0);
    return {
      participantId: person.id, groupId: assignment.groupId,
      state: working ? "in_progress" : attempt ? "done" : "not_started",
      ...(attempt?.submittedAt ? { submittedAt: attempt.submittedAt.toISOString() } : {}),
      ...(attempt?.lifecycle === "started" ? { attemptNumber: attempt.attemptNumber, startedAt: attempt.startedAt.toISOString() } : {})
    };
  }));
  const inProgress: CourseActivityInProgressAttempt[] = [...latest.values()].filter(attempt => attempt.lifecycle === "started").map(attempt => ({
    participantId: attempt.participantId, groupId: attempt.groupId, attemptNumber: attempt.attemptNumber, startedAt: attempt.startedAt.toISOString()
  }));
  return { attempts: inProgress, progress, participants, activityTypeKey: assignments[0]?.activity.activityType.key ?? "", activityMetadata, assignmentMetadata };
}
