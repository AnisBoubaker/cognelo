import { StudentTeamChoiceSchema, type CurrentUser, type MyStudentGroupingDto, type StudentTeamChoiceState } from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError, forbidden, notFound } from "./errors";

type ChoicePolicy = { studentChoiceEnabled: boolean; choiceOpensAt: Date | null; choiceClosesAt: Date | null; allowChoiceChanges: boolean };

export function studentTeamChoiceState(policy: ChoicePolicy, hasTeam: boolean, now: Date): StudentTeamChoiceState {
  if (!policy.studentChoiceEnabled) return "disabled";
  // The closing instant is exclusive, including when changes were previously allowed.
  if (policy.choiceClosesAt && now >= policy.choiceClosesAt) return "closed";
  if (policy.choiceOpensAt && now < policy.choiceOpensAt) return "upcoming";
  if (hasTeam && !policy.allowChoiceChanges) return "locked";
  return "open";
}

async function requireStudent(tx: Prisma.TransactionClient, user: CurrentUser, courseId: string, groupId: string) {
  const student = await tx.courseGroupParticipant.findFirst({
    where: { userId: user.id, groupId, role: "student", group: { courseId } },
    select: { id: true, group: { select: { status: true, availableFrom: true, availableUntil: true } } }
  });
  if (!student) throw forbidden();
  const now = new Date();
  if (student.group.status !== "published" || (student.group.availableFrom && now < student.group.availableFrom) || (student.group.availableUntil && now > student.group.availableUntil)) {
    throw new AppError(403, "GROUP_NOT_AVAILABLE", "This section is not currently available.");
  }
  return student;
}

export async function listMyStudentGroupings(user: CurrentUser, courseId: string, groupId: string): Promise<{ groupings: MyStudentGroupingDto[] }> {
  const student = await requireStudent(prisma, user, courseId, groupId);
  const groupings = await prisma.studentGrouping.findMany({
    where: { groupId }, orderBy: [{ title: "asc" }, { id: "asc" }],
    include: { teams: { orderBy: [{ title: "asc" }, { id: "asc" }], include: { members: {
      where: { participant: { role: "student", groupId } },
      orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }, { participantId: "asc" }],
      select: { participantId: true, participant: { select: { firstName: true, lastName: true } } }
    } } } }
  });
  const now = new Date();
  return { groupings: groupings.map((grouping) => {
    const ownTeamId = grouping.teams.find((team) => team.members.some((member) => member.participantId === student.id))?.id ?? null;
    return {
      id: grouping.id, title: grouping.title, ownTeamId,
      choiceState: studentTeamChoiceState(grouping, ownTeamId !== null, now),
      choiceOpensAt: grouping.choiceOpensAt?.toISOString() ?? null,
      choiceClosesAt: grouping.choiceClosesAt?.toISOString() ?? null,
      allowChoiceChanges: grouping.allowChoiceChanges,
      // Manual groupings expose only the learner's team. Descriptions, email addresses,
      // enrollment IDs, revision/audit data, and other manual teams stay private.
      teams: grouping.teams.filter((team) => grouping.studentChoiceEnabled || team.id === ownTeamId).map((team) => ({
        id: team.id, title: team.title, capacity: team.capacity,
        members: team.members.map((member) => ({ name: `${member.participant.firstName} ${member.participant.lastName}`.trim(), isSelf: member.participantId === student.id }))
      }))
    };
  }) };
}

export async function chooseStudentTeam(user: CurrentUser, courseId: string, groupId: string, groupingId: string, input: unknown) {
  const { teamId } = StudentTeamChoiceSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const student = await requireStudent(tx, user, courseId, groupId);
      const grouping = await tx.studentGrouping.findFirst({
        where: { id: groupingId, groupId }, include: { teams: { include: { members: { select: { participantId: true } } } } }
      });
      if (!grouping) throw notFound("Student grouping");
      const previousTeam = grouping.teams.find((team) => team.members.some((member) => member.participantId === student.id));
      const state = studentTeamChoiceState(grouping, Boolean(previousTeam), new Date());
      if (state === "disabled" || state === "upcoming" || state === "closed") {
        throw new AppError(403, "STUDENT_TEAM_CHOICE_NOT_OPEN", "Team selection is not open.");
      }
      if (previousTeam?.id === teamId) return { ok: true as const };
      if (state === "locked") throw new AppError(403, "STUDENT_TEAM_CHOICE_LOCKED", "You cannot change your team choice.");
      const team = grouping.teams.find((item) => item.id === teamId);
      if (!team) throw notFound("Student team");
      if (team.members.length >= team.capacity) throw new AppError(409, "STUDENT_TEAM_FULL", "This team has no available slots.");
      // Every student choice advances the teacher revision too, so a stale full-draft
      // save cannot overwrite choices. Serializable isolation protects the last slot.
      const changed = await tx.studentGrouping.updateMany({
        where: { id: groupingId, groupId, revision: grouping.revision }, data: { revision: { increment: 1 } }
      });
      if (changed.count !== 1) throw choiceConflict();
      await tx.studentTeamMember.upsert({
        where: { groupingId_participantId: { groupingId, participantId: student.id } },
        create: { groupingId, participantId: student.id, teamId }, update: { teamId }
      });
      await tx.courseAuditEvent.create({ data: {
        courseId, actorUserId: user.id, eventType: "student_team_chosen", targetType: "student_grouping", targetId: groupingId,
        previousValue: { participantId: student.id, teamId: previousTeam?.id ?? null },
        nextValue: { participantId: student.id, teamId }
      } });
      return { ok: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2025", "P2034"].includes(error.code)) throw choiceConflict();
    throw error;
  }
}

function choiceConflict() {
  return new AppError(409, "STUDENT_TEAM_CHOICE_CONFLICT", "Team availability changed. Review the teams and try again.");
}
