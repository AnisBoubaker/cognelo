import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, assertCanManageCourse, consumeRateLimits, contentIndexRevision, getActivityMaterialReferences, getActivityMaterialReferenceState, NonRetryableBackgroundJobError, snapshotAiModelSelection } from "@cognelo/core";
import { prisma } from "./db-client";
import type { HomeworkTeacherScope } from "./workflow-settings";
import { record } from "./file-preparation";
import { snapshotProvidedCode } from "./provided-code";
import { getHomeworkQuestionConnection } from "./ai-selection";
import { getHomeworkQuestionLanguage } from "./question-generation-policy";
import { generatePreparedHomeworkQuestions } from "./prepared-question-generation";

const state = globalThis as typeof globalThis & { cogneloHomeworkSimulations?: Set<string> };
const active = state.cogneloHomeworkSimulations ??= new Set<string>();
async function inputs(scope: HomeworkTeacherScope) {
  const [assignment, solution, references, referenceState, providedCode, questionLanguage] = await Promise.all([
    prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } }),
    prisma.pluginCodingHomeworkTeacherSolution.findUnique({ where: { ownerKind_ownerId: { ownerKind: "course_activity", ownerId: scope.activityId } } }),
    getActivityMaterialReferences(scope), getActivityMaterialReferenceState(scope), snapshotProvidedCode(scope.activityId), getHomeworkQuestionLanguage(scope.courseId)
  ]);
  const files = z.array(z.object({ path: z.string().min(1), text: z.string() }).passthrough()).max(1000).parse(solution?.files ?? []);
  if (!files.length) throw new AppError(409, "HOMEWORK_SOLUTION_REQUIRED", "Upload a private teacher solution before running a simulation.");
  if (files.reduce((size, file) => size + Buffer.byteLength(file.text), 0) > 2_000_000) throw new AppError(413, "HOMEWORK_SOLUTION_LIMIT", "The solution exceeds its analysis limit.");
  if (references.selected.length && !references.prepared) throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Save and prepare the reference selection before running a simulation.");
  const settings = { promptMarkdown: assignment?.promptMarkdown ?? "", languageKey: assignment?.languageKey ?? "c", candidateLimit: assignment?.candidateLimit ?? 5, questionCount: assignment?.questionCount ?? 3, retrievedExampleCount: assignment?.retrievedExampleCount ?? 3, generationInstructions: assignment?.generationInstructions ?? "" };
  const connection = await getHomeworkQuestionConnection(scope, record(assignment?.settings));
  const referenceSnapshot = referenceState.prepared ? { ...referenceState.prepared } : {};
  const revision = contentIndexRevision({ files, settings, providedCode, questionLanguage, referenceSnapshot, model: snapshotAiModelSelection(connection) });
  return { sources: files.map(file => ({ path: file.path, content: file.text, languageKey: "c" })), settings, referenceSnapshot, providedCode, questionLanguage, connection, revision };
}
export async function simulateHomeworkQuestions(scope: HomeworkTeacherScope, input: unknown, signal?: AbortSignal) {
  await assertCanManageCourse(scope.user, scope.courseId); z.object({}).strict().parse(input);
  await consumeRateLimits([{ scope: "homework-simulation-user", subject: scope.user.id, limit: 6, windowMs: 60_000 }, { scope: "homework-simulation-activity", subject: scope.activityId, limit: 6, windowMs: 60_000 }]);
  const key = `${scope.user.id}:${scope.activityId}`;
  if (active.has(key)) throw new AppError(409, "HOMEWORK_SIMULATION_BUSY", "A simulation is already running for this activity.");
  active.add(key);
  try {
    signal?.throwIfAborted(); const context = await inputs(scope);
    const result = await generatePreparedHomeworkQuestions({ scope, ...context, signal });
    signal?.throwIfAborted();
    if ((await inputs(scope)).revision !== context.revision) throw new AppError(409, "HOMEWORK_SIMULATION_CHANGED", "The saved solution, settings or references changed during simulation. Generate a new simulation.");
    return { generatedAt: new Date().toISOString(), questionLanguage: context.questionLanguage,
      questions: result.generated.map((question, orderIndex) => ({ id: randomUUID(), orderIndex, questionText: question.text, context: question.context })) };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof NonRetryableBackgroundJobError) throw new AppError(422, "HOMEWORK_SIMULATION_FAILED", error.message);
    throw error;
  } finally { active.delete(key); }
}
