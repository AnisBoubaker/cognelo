import { randomUUID } from "node:crypto";
import {
  StudentGroupingDeleteSchema, StudentGroupingInputSchema, StudentGroupingUpdateSchema,
  type CurrentUser, type StudentGroupingDto, type StudentGroupingInput
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { assertCanManageGroupRoster } from "./authorization";
import { AppError, notFound } from "./errors";

const includeTeams = { teams: {
  orderBy: [{ title: "asc" as const }, { id: "asc" as const }],
  include: { members: { select: { participantId: true }, orderBy: { participantId: "asc" as const } } }
} };
type StoredGrouping = Prisma.StudentGroupingGetPayload<{ include: typeof includeTeams }>;

function toDto(grouping: StoredGrouping): StudentGroupingDto {
  return {
    id: grouping.id, groupId: grouping.groupId, title: grouping.title,
    description: grouping.description, revision: grouping.revision,
    teams: grouping.teams.map((team) => ({ id: team.id, title: team.title, participantIds: team.members.map((member) => member.participantId) }))
  };
}

async function authorize(user: CurrentUser, courseId: string, groupId: string) {
  await assertCanManageGroupRoster(user, courseId, groupId);
  if (!await prisma.courseGroup.findFirst({ where: { id: groupId, courseId }, select: { id: true } })) {
    throw notFound("Section");
  }
}

export async function listStudentGroupings(user: CurrentUser, courseId: string, groupId: string) {
  await authorize(user, courseId, groupId);
  const [groupings, students] = await Promise.all([
    prisma.studentGrouping.findMany({ where: { groupId }, include: includeTeams, orderBy: [{ title: "asc" }, { id: "asc" }] }),
    prisma.courseGroupParticipant.findMany({
      where: { role: "student", groupId },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }]
    })
  ]);
  return { groupings: groupings.map(toDto), students };
}

async function validateTeams(tx: Prisma.TransactionClient, groupId: string, teams: StudentGroupingInput["teams"], previous?: StoredGrouping) {
  const teamIds = teams.flatMap((team) => team.id ? [team.id] : []);
  if (new Set(teamIds).size !== teamIds.length || teamIds.some((id) => !previous?.teams.some((team) => team.id === id))) {
    throw new AppError(400, "STUDENT_GROUPING_TEAMS_INVALID", "Select only teams belonging to this grouping.");
  }
  if (new Set(teams.map((team) => team.title.toLowerCase())).size !== teams.length) {
    throw new AppError(400, "STUDENT_GROUPING_TEAM_NAMES_DUPLICATE", "Use a different name for each team.");
  }
  const ids = teams.flatMap((team) => team.participantIds);
  if (new Set(ids).size !== ids.length) {
    throw new AppError(400, "STUDENT_GROUPING_MEMBERS_DUPLICATE", "A student can belong to only one team in each grouping.");
  }
  const participants = await tx.courseGroupParticipant.findMany({
    where: { id: { in: ids }, role: "student", groupId }, select: { id: true }
  });
  if (participants.length !== ids.length) {
    throw new AppError(400, "STUDENT_GROUPING_MEMBERS_INVALID", "Select only students enrolled in this section.");
  }
}

function conflict() {
  return new AppError(409, "STUDENT_GROUPING_CONFLICT", "This grouping has changed. Reload it before saving or deleting.");
}

async function transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await prisma.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new AppError(409, "STUDENT_GROUPING_TITLE_EXISTS", "A grouping with this name already exists in this section.");
      if (error.code === "P2034" || error.code === "P2003") throw conflict();
    }
    throw error;
  }
}

export async function createStudentGrouping(user: CurrentUser, courseId: string, groupId: string, input: unknown) {
  await authorize(user, courseId, groupId);
  const data = StudentGroupingInputSchema.parse(input);
  return transaction(async (tx) => {
    await validateTeams(tx, groupId, data.teams);
    const grouping = await tx.studentGrouping.create({
      data: { groupId, title: data.title, description: data.description, teams: { create: data.teams.map((team) => ({ title: team.title })) } },
      include: includeTeams
    });
    await tx.studentTeamMember.createMany({ data: data.teams.flatMap((team) => team.participantIds.map((participantId) => ({
      groupingId: grouping.id, teamId: grouping.teams.find((stored) => stored.title === team.title)!.id, participantId
    }))) });
    const result = await tx.studentGrouping.findUniqueOrThrow({ where: { id: grouping.id }, include: includeTeams });
    await tx.courseAuditEvent.create({ data: {
      courseId, actorUserId: user.id, eventType: "student_grouping_created", targetType: "student_grouping",
      targetId: grouping.id, nextValue: toDto(result)
    } });
    return toDto(result);
  });
}

export async function updateStudentGrouping(user: CurrentUser, courseId: string, groupId: string, groupingId: string, input: unknown) {
  await authorize(user, courseId, groupId);
  const data = StudentGroupingUpdateSchema.parse(input);
  return transaction(async (tx) => {
    const previous = await tx.studentGrouping.findFirst({ where: { id: groupingId, groupId }, include: includeTeams });
    if (!previous) throw notFound("Student grouping");
    if (previous.revision !== data.revision) throw conflict();
    await validateTeams(tx, groupId, data.teams, previous);
    const updated = await tx.studentGrouping.updateMany({
      where: { id: groupingId, groupId, revision: data.revision },
      data: { title: data.title, description: data.description, revision: { increment: 1 } }
    });
    if (updated.count !== 1) throw conflict();
    await tx.studentTeamMember.deleteMany({ where: { groupingId } });
    await tx.studentTeam.deleteMany({ where: { groupingId, id: { notIn: data.teams.flatMap((team) => team.id ? [team.id] : []) } } });
    // Free existing names before applying renames so two retained teams can swap names.
    for (const team of data.teams.filter((team) => team.id)) {
      await tx.studentTeam.update({ where: { id: team.id! }, data: { title: randomUUID() } });
    }
    for (const team of data.teams) {
      const saved = team.id
        ? await tx.studentTeam.update({ where: { id: team.id }, data: { title: team.title } })
        : await tx.studentTeam.create({ data: { groupingId, title: team.title } });
      await tx.studentTeamMember.createMany({ data: team.participantIds.map((participantId) => ({ groupingId, teamId: saved.id, participantId })) });
    }
    const grouping = await tx.studentGrouping.findUniqueOrThrow({ where: { id: groupingId }, include: includeTeams });
    await tx.courseAuditEvent.create({ data: {
      courseId, actorUserId: user.id, eventType: "student_grouping_updated", targetType: "student_grouping",
      targetId: groupingId, previousValue: toDto(previous), nextValue: toDto(grouping)
    } });
    return toDto(grouping);
  });
}

export async function deleteStudentGrouping(user: CurrentUser, courseId: string, groupId: string, groupingId: string, input: unknown) {
  await authorize(user, courseId, groupId);
  const data = StudentGroupingDeleteSchema.parse(input);
  return transaction(async (tx) => {
    const grouping = await tx.studentGrouping.findFirst({ where: { id: groupingId, groupId }, include: includeTeams });
    if (!grouping) throw notFound("Student grouping");
    const removed = await tx.studentGrouping.deleteMany({ where: { id: groupingId, groupId, revision: data.revision } });
    if (removed.count !== 1) throw conflict();
    await tx.courseAuditEvent.create({ data: {
      courseId, actorUserId: user.id, eventType: "student_grouping_deleted", targetType: "student_grouping",
      targetId: groupingId, previousValue: toDto(grouping)
    } });
    return { ok: true as const };
  });
}
