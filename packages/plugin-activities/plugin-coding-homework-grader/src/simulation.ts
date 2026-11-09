import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, assertCanManageCourse, consumeRateLimits, contentIndexRevision, getActivityMaterialReferences, getActivityMaterialReferenceState, NonRetryableBackgroundJobError, snapshotAiModelSelection } from "@cognelo/core";
import { prisma } from "./db-client";
import type { HomeworkTeacherScope } from "./workflow-settings";
import { record } from "./file-preparation";
import { homeworkQuestionsEnabled } from "./question-policy";
import { readHomeworkSimulationPreflight } from "./preflight";
import { snapshotProvidedCode } from "./provided-code";
import { getHomeworkQuestionConnection } from "./ai-selection";
import { getHomeworkQuestionLanguage } from "./question-generation-policy";
import { generatePreparedHomeworkQuestions } from "./prepared-question-generation";

const state = globalThis as typeof globalThis & { cogneloHomeworkSimulations?: Set<string> };
const active = state.cogneloHomeworkSimulations ??= new Set<string>();
async function inputs(scope: HomeworkTeacherScope, preflightId: string, acknowledgeIncomplete: boolean) {
  const assignment = await prisma.pluginCodingHomeworkAssignment.findUnique({ where: { activityId: scope.activityId } });
  const preflight = await readHomeworkSimulationPreflight(scope, preflightId, acknowledgeIncomplete);
  const questionsEnabled = homeworkQuestionsEnabled(assignment?.settings);
  const settings = { promptMarkdown: assignment?.promptMarkdown ?? "", languageKey: assignment?.languageKey ?? "c", candidateLimit: assignment?.candidateLimit ?? 5, questionCount: assignment?.questionCount ?? 3, retrievedExampleCount: assignment?.retrievedExampleCount ?? 3, generationInstructions: assignment?.generationInstructions ?? "" };
  const revisionInputs = { preflight: preflight.fingerprint, settings, questionsEnabled };
  if (!questionsEnabled) return { questionsEnabled, ...preflight, settings, revision: contentIndexRevision(revisionInputs), referenceSnapshot: {}, providedCode: null, questionLanguage: null, connection: null };
  const [references, referenceState, providedCode, questionLanguage, connection] = await Promise.all([
    getActivityMaterialReferences(scope), getActivityMaterialReferenceState(scope), snapshotProvidedCode(scope.activityId), getHomeworkQuestionLanguage(scope.courseId), getHomeworkQuestionConnection(scope, record(assignment?.settings))
  ]);
  if (references.selected.length && !references.prepared) throw new AppError(409, "HOMEWORK_EMBEDDINGS_REQUIRED", "Save and prepare the reference selection before running a simulation.");
  const referenceSnapshot = referenceState.prepared ? { ...referenceState.prepared } : {};
  return { questionsEnabled, ...preflight, settings, referenceSnapshot, providedCode, questionLanguage, connection,
    revision: contentIndexRevision({ ...revisionInputs, providedCode, questionLanguage, referenceSnapshot, model: snapshotAiModelSelection(connection) }) };
}
export async function simulateHomeworkQuestions(scope: HomeworkTeacherScope, input: unknown, signal?: AbortSignal) {
  await assertCanManageCourse(scope.user, scope.courseId);
  const { preflightId, acknowledgeIncomplete } = z.object({ preflightId: z.string().min(1), acknowledgeIncomplete: z.boolean().default(false) }).strict().parse(input);
  await consumeRateLimits([{ scope: "homework-simulation-user", subject: scope.user.id, limit: 6, windowMs: 60_000 }, { scope: "homework-simulation-activity", subject: scope.activityId, limit: 6, windowMs: 60_000 }]);
  const key = `${scope.user.id}:${scope.activityId}`;
  if (active.has(key)) throw new AppError(409, "HOMEWORK_SIMULATION_BUSY", "A simulation is already running for this activity.");
  active.add(key);
  try {
    signal?.throwIfAborted(); const context = await inputs(scope, preflightId, acknowledgeIncomplete);
    const result = context.questionsEnabled ? await generatePreparedHomeworkQuestions({ scope, ...context, providedCode: context.providedCode!, questionLanguage: context.questionLanguage!, connection: context.connection!, signal }) : { generated: [] };
    signal?.throwIfAborted();
    if ((await inputs(scope, preflightId, acknowledgeIncomplete)).revision !== context.revision) throw new AppError(409, "HOMEWORK_SIMULATION_CHANGED", "The checked ZIP, saved settings or references changed during simulation. Generate a new simulation.");
    return { questionGenerationEnabled: context.questionsEnabled, incompleteAcknowledged: context.incomplete, generatedAt: new Date().toISOString(), questionLanguage: context.questionLanguage,
      questions: result.generated.map((question, orderIndex) => ({ id: randomUUID(), orderIndex, questionText: question.text, context: question.context })) };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof NonRetryableBackgroundJobError) throw new AppError(422, "HOMEWORK_SIMULATION_FAILED", error.message);
    throw error;
  } finally { active.delete(key); }
}
