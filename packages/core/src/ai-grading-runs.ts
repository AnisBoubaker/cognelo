import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@cognelo/db";
import type { CurrentUser, AiGradingRunSummary } from "@cognelo/contracts";
import { assertCanGradeGroup, assertCanViewCourseGradebook } from "./authorization";
import { getActivityAttemptRegradeContexts } from "./gradebook";
import { AppError, notFound } from "./errors";
import { prepareAiGradingAttempt, commitPreparedAiGrading, type PreparedAiGrading, type AiGradingGuidance } from "./ai-grading-preparation";

type AiGradingRun = Prisma.AiGradingRunGetPayload<Record<string, never>>;
const LEASE_MS = 45_000;
type Entry = {
  attemptId: string; groupId: string; name: string;
  status: "pending" | "processing" | "completed" | "failed";
  token?: string; error?: string; prepared?: PreparedAiGrading;
};
const entries = (run: AiGradingRun) => run.entries as unknown as Entry[];
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const stopped = () => new AppError(409, "AI_GRADING_STOPPED", "The grading run has stopped. Review its completed copies.");

function summary(run: AiGradingRun): AiGradingRunSummary {
  const students = entries(run).map(({ attemptId, name, status, error }) => ({ attemptId, name, status, error: error ?? null }));
  return { id: run.id, activityId: run.activityId, status: run.status as AiGradingRunSummary["status"],
    stopReason: run.stopReason, students, total: students.length, completed: students.filter(s => s.status === "completed").length };
}

async function authorize(user: CurrentUser, courseId: string, run: AiGradingRun | null) {
  if (!run || run.courseId !== courseId || run.actorUserId !== user.id) throw notFound("AI grading run");
  await assertCanViewCourseGradebook(user, courseId);
  for (const groupId of new Set(entries(run).map(entry => entry.groupId))) await assertCanGradeGroup(user, courseId, groupId);
  return run;
}

async function locked(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "AiGradingRun" WHERE id = ${id} FOR UPDATE`;
  return tx.aiGradingRun.findUniqueOrThrow({ where: { id } });
}
async function expire(tx: Prisma.TransactionClient, run: AiGradingRun) {
  return run.status === "running" && Date.now() - run.heartbeatAt.getTime() >= LEASE_MS
    ? tx.aiGradingRun.update({ where: { id: run.id }, data: {
        status: "review", stopReason: "interrupted",
        entries: json(entries(run).map(entry => entry.status === "processing" ? { ...entry, status: "pending", token: undefined } : entry))
      } }) : run;
}

export async function createAiGradingRun(user: CurrentUser, courseId: string, activityId: string,
  input: AiGradingGuidance & { attemptIds: string[] }) {
  if (!input.attemptIds.length || input.attemptIds.length > 500 || new Set(input.attemptIds).size !== input.attemptIds.length) {
    throw new AppError(400, "AI_GRADING_TARGETS_INVALID", "Choose between 1 and 500 distinct submissions.");
  }
  if (input.templateAttemptIds?.some(id => input.attemptIds.includes(id))) throw new AppError(400, "AI_BATCH_TEMPLATE_TARGET_MATCH", "Templates cannot be grading targets.");
  const contexts = await getActivityAttemptRegradeContexts(user, courseId, input.attemptIds);
  if (contexts.length !== input.attemptIds.length || contexts.some(c => c.activityId !== activityId || !["submitted", "graded"].includes(c.lifecycle))) {
    throw new AppError(400, "AI_GRADING_TARGETS_INVALID", "Every target must be a submitted copy of this activity.");
  }
  const attempts = await prisma.activityAttempt.findMany({ where: { id: { in: input.attemptIds }, courseId }, include: { participant: true } });
  if (new Set(attempts.map(attempt => `${attempt.gradebookItemId}:${attempt.participantId}`)).size !== attempts.length) {
    throw new AppError(400, "AI_GRADING_TARGETS_INVALID", "Choose one submission per student and section.");
  }
  const byId = new Map(attempts.map(attempt => [attempt.id, attempt]));
  const targets: Entry[] = input.attemptIds.map(id => {
    const attempt = byId.get(id)!;
    return { attemptId: id, groupId: attempt.groupId, name: `${attempt.participant.firstName} ${attempt.participant.lastName}`.trim() || attempt.participant.email, status: "pending" };
  });
  try {
    const run = await prisma.aiGradingRun.create({ data: { courseId, activityId, actorUserId: user.id,
      activeKey: `${user.id}:${activityId}`, entries: json(targets),
      guidance: json({ instructions: input.instructions, templateAttemptIds: input.templateAttemptIds }) } });
    return summary(run);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") throw new AppError(409, "AI_GRADING_RUN_PENDING", "Resolve the previous grading run before starting another one.");
    throw error;
  }
}

export async function getAiGradingRun(user: CurrentUser, courseId: string, id: string) {
  await authorize(user, courseId, await prisma.aiGradingRun.findUnique({ where: { id } }));
  return summary(await prisma.$transaction(async tx => expire(tx, await locked(tx, id))));
}
export async function getPendingAiGradingRun(user: CurrentUser, courseId: string, activityId: string) {
  await assertCanViewCourseGradebook(user, courseId);
  const run = await prisma.aiGradingRun.findUnique({ where: { activeKey: `${user.id}:${activityId}` } });
  return run ? getAiGradingRun(user, courseId, run.id) : null;
}

export async function processAiGradingRunAttempt(user: CurrentUser, courseId: string, id: string, attemptId: string) {
  await authorize(user, courseId, await prisma.aiGradingRun.findUnique({ where: { id } }));
  const token = randomUUID();
  const claimed = await prisma.$transaction(async tx => {
    const run = await expire(tx, await locked(tx, id));
    if (run.status !== "running") return null;
    const items = entries(run);
    const entry = items.find(item => item.attemptId === attemptId);
    if (!entry) throw notFound("Grading target");
    if (entry.status === "completed") return null; // Retry after a lost response never reruns the model.
    if (entry.status !== "pending" || items.some(item => item.status === "processing")) throw new AppError(409, "AI_GRADING_IN_PROGRESS", "Another copy is being graded.");
    entry.status = "processing"; entry.token = token;
    return tx.aiGradingRun.update({ where: { id }, data: { entries: json(items) } });
  });
  if (!claimed) return getAiGradingRun(user, courseId, id);
  const checkRunning = async () => {
    const run = await prisma.aiGradingRun.findUniqueOrThrow({ where: { id } });
    if (run.status !== "running" || Date.now() - run.heartbeatAt.getTime() >= LEASE_MS) throw stopped();
  };
  try {
    const prepared = await prepareAiGradingAttempt(user, courseId, attemptId, claimed.guidance as AiGradingGuidance, checkRunning);
    await prisma.$transaction(async tx => {
      const run = await expire(tx, await locked(tx, id));
      if (run.status !== "running") return;
      const items = entries(run); const entry = items.find(item => item.attemptId === attemptId);
      if (entry?.token !== token || entry.status !== "processing") return;
      entry.status = "completed"; entry.prepared = prepared; delete entry.token;
      await tx.aiGradingRun.update({ where: { id }, data: { entries: json(items) } });
    });
  } catch (error) {
    await prisma.$transaction(async tx => {
      const run = await expire(tx, await locked(tx, id));
      if (run.status !== "running") return;
      const items = entries(run); const entry = items.find(item => item.attemptId === attemptId);
      if (entry?.token !== token) return;
      entry.status = "failed"; delete entry.token;
      entry.error = error instanceof AppError ? error.message.slice(0, 1000) : "AI grading was interrupted. Previous grades are unchanged.";
      await tx.aiGradingRun.update({ where: { id }, data: { entries: json(items), status: "review", stopReason: "failed" } });
    });
  }
  return getAiGradingRun(user, courseId, id);
}

export async function actOnAiGradingRun(user: CurrentUser, courseId: string, id: string,
  action: "heartbeat" | "cancel" | "interrupt" | "keep" | "discard" | "finish") {
  await authorize(user, courseId, await prisma.aiGradingRun.findUnique({ where: { id } }));
  try {
    const result = await prisma.$transaction(async tx => {
      const run = await expire(tx, await locked(tx, id));
      if (["completed", "discarded"].includes(run.status)) return run;
      const items = entries(run);
      if (action === "heartbeat") return run.status === "running"
        ? tx.aiGradingRun.update({ where: { id }, data: { heartbeatAt: new Date() } }) : run;
      if (action === "cancel" || action === "interrupt") return tx.aiGradingRun.update({ where: { id }, data: {
        status: "review", stopReason: action === "cancel" ? "cancelled" : "interrupted",
        entries: json(items.map(entry => entry.status === "processing" ? { ...entry, status: "pending", token: undefined } : entry))
      } });
      if (action === "finish" && run.status !== "running") return run;
      if (action === "finish" && items.some(entry => entry.status !== "completed")) throw stopped();
      if (action === "keep" && run.status !== "review") throw stopped();
      if (action !== "discard") {
        for (const entry of items.filter(item => item.status === "completed").sort((a, b) => a.attemptId.localeCompare(b.attemptId))) {
          if (!entry.prepared) throw stopped();
          await commitPreparedAiGrading(user, courseId, entry.prepared, tx);
        }
      }
      await tx.courseAuditEvent.create({ data: { courseId, actorUserId: user.id, eventType: action === "discard" ? "ai_grading_run_discarded" : "ai_grading_run_kept",
        targetType: "AiGradingRun", targetId: id, nextValue: { attemptIds: items.filter(entry => entry.status === "completed").map(entry => entry.attemptId) } } });
      return tx.aiGradingRun.update({ where: { id }, data: { activeKey: null, status: action === "discard" ? "discarded" : "completed",
        entries: json(items.map(({ prepared: _prepared, token: _token, ...entry }) => entry)) } });
    }, { timeout: 30_000, maxWait: 10_000, isolationLevel: "Serializable" });
    return summary(result);
  } catch (error) {
    if (action === "keep" || action === "finish") await prisma.aiGradingRun.updateMany({ where: { id, status: { in: ["running", "review"] } }, data: { status: "review", stopReason: "conflict" } });
    throw error;
  }
}
