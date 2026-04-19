import { z } from "zod";
import { resetParsonsBlocks, type ParsonsBlock, type ParsonsConfig } from "./parsons";

export const parsonsBlockSchema = z.object({
  id: z.string().min(1).max(160),
  displayText: z.string(),
  originalText: z.string(),
  sourceIndex: z.number().int().min(0),
  physicalLineIndex: z.number().int().min(0),
  unitId: z.string().min(1).max(160),
  groupId: z.string().min(1).max(80).nullable(),
  expectedIndent: z.number().int().min(0).max(12),
  currentIndent: z.number().int().min(0).max(12)
});

export const parsonsAttemptEvaluationSchema = z.object({
  isCorrect: z.boolean(),
  orderCorrect: z.boolean(),
  indentationCorrect: z.boolean(),
  misplacedBlocks: z.number().int().min(0),
  incorrectIndents: z.number().int().min(0)
});

export const parsonsAttemptStateSchema = z.object({
  configFingerprint: z.string().min(1).max(64),
  blocks: z.array(parsonsBlockSchema),
  selectedBlockId: z.string().min(1).max(160).nullable().optional(),
  lastEvaluation: parsonsAttemptEvaluationSchema.nullable().optional()
});

export const parsonsAttemptEnsureInputSchema = z.object({
  forceNew: z.boolean().optional().default(false)
});

export const parsonsAttemptEventTypeSchema = z.enum(["move", "indent", "reset", "check"]);

export const parsonsAttemptEventSchema = z.object({
  type: parsonsAttemptEventTypeSchema,
  payload: z.record(z.unknown()).optional().default({})
});

export const parsonsAttemptUpdateInputSchema = z.object({
  attemptId: z.string().cuid(),
  state: parsonsAttemptStateSchema.optional(),
  event: parsonsAttemptEventSchema.optional(),
  result: parsonsAttemptEvaluationSchema.optional(),
  complete: z.boolean().optional().default(false),
  abandon: z.boolean().optional().default(false)
});

export type ParsonsAttemptEvaluation = z.infer<typeof parsonsAttemptEvaluationSchema>;
export type ParsonsAttemptState = z.infer<typeof parsonsAttemptStateSchema>;
export type ParsonsAttemptEnsureInput = z.infer<typeof parsonsAttemptEnsureInputSchema>;
export type ParsonsAttemptUpdateInput = z.infer<typeof parsonsAttemptUpdateInputSchema>;
export type ParsonsAttemptEventType = z.infer<typeof parsonsAttemptEventTypeSchema>;

export function createInitialParsonsAttemptState(config: ParsonsConfig): ParsonsAttemptState {
  return {
    configFingerprint: getParsonsConfigFingerprint(config),
    blocks: resetParsonsBlocks(config),
    selectedBlockId: null,
    lastEvaluation: null
  };
}

export function buildParsonsAttemptState(
  config: ParsonsConfig,
  blocks: ParsonsBlock[],
  selectedBlockId: string | null,
  lastEvaluation?: ParsonsAttemptEvaluation | null
): ParsonsAttemptState {
  return {
    configFingerprint: getParsonsConfigFingerprint(config),
    blocks,
    selectedBlockId,
    lastEvaluation: lastEvaluation ?? null
  };
}

export function getParsonsConfigFingerprint(config: ParsonsConfig) {
  return hashValue(
    JSON.stringify({
      solution: config.solution,
      language: config.language,
      stripIndentation: config.stripIndentation,
      groups: config.groups,
      precedenceRules: config.precedenceRules
    })
  );
}

function hashValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
