import { z } from "zod";
import { buildParsonsBlocks, projectParsonsBlocks, parseParsonsConfig, resetParsonsBlocks, type ParsonsBlock, type ParsonsConfig } from "./parsons";

export const parsonsBlockSchema = z.object({
  id: z.string().min(1).max(160),
  displayText: z.string(),
  originalText: z.string().default(""),
  sourceIndex: z.number().int().min(0).default(0),
  physicalLineIndex: z.number().int().min(0).default(0),
  unitId: z.string().min(1).max(160).default("student"),
  groupId: z.string().min(1).max(80).nullable().default(null),
  expectedIndent: z.number().int().min(0).max(12).default(0),
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
  // Test review metadata survives grading/reopening but never affects evaluation.
  hasAnswer: z.boolean().optional(),
  selectedBlockId: z.string().min(1).max(160).nullable().optional(),
  lastEvaluation: parsonsAttemptEvaluationSchema.nullable().optional()
});

export const parsonsAttemptEnsureInputSchema = z.object({
  forceNew: z.boolean().optional().default(false)
});

export const parsonsAttemptEventTypeSchema = z.enum(["move", "indent", "reset", "check", "submit"]);

export const parsonsAttemptEventSchema = z.object({
  type: parsonsAttemptEventTypeSchema,
  payload: z.record(z.string(), z.unknown()).prefault({})
});

export const parsonsAttemptUpdateInputSchema = z.object({
  attemptId: z.string().cuid(),
  state: parsonsAttemptStateSchema.optional(),
  event: parsonsAttemptEventSchema.optional(),
  result: parsonsAttemptEvaluationSchema.optional(),
  submit: z.boolean().optional().default(false),
  complete: z.boolean().optional().default(false),
  abandon: z.boolean().optional().default(false)
});

export type ParsonsAttemptEvaluation = z.infer<typeof parsonsAttemptEvaluationSchema>;
export type ParsonsAttemptState = z.infer<typeof parsonsAttemptStateSchema>;
export type ParsonsAttemptEnsureInput = z.infer<typeof parsonsAttemptEnsureInputSchema>;
export type ParsonsAttemptUpdateInput = z.input<typeof parsonsAttemptUpdateInputSchema>;
export type ParsonsAttemptEventType = z.infer<typeof parsonsAttemptEventTypeSchema>;

export function hasParsonsAnswer(_config: Record<string, unknown>, state: Record<string, unknown> | null) {
  // Older Test drafts predate this marker; retain their saved arrangement as a response.
  return state?.hasAnswer === true || (state?.hasAnswer === undefined && Array.isArray(state?.blocks) && state.blocks.length > 0);
}

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
  if (config.studentBlocks) return "student";
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

/** Keep the student's arrangement while applying corrected lines/rules. New lines are appended. */
export function reconcileParsonsResponseState(_previousConfig: unknown, nextConfig: unknown, value: Record<string, unknown>): Record<string, unknown> {
  const config = parseParsonsConfig(nextConfig as Record<string, unknown>);
  const parsed = parsonsAttemptStateSchema.safeParse(value);
  if (!parsed.success) return value;
  const state = parsed.data;
  const configFingerprint = getParsonsConfigFingerprint(config);
  if (!config.studentBlocks && state.configFingerprint === configFingerprint) return { ...state, lastEvaluation: null };
  const available = buildParsonsBlocks("revision", config).sort((a, b) => a.displayText.localeCompare(b.displayText));
  // Reserve text matches first, so a removed/edited line cannot steal another line's identity.
  const matches = state.blocks.map((block) => available.find((candidate) => candidate.displayText === block.displayText));
  const used = new Set<ParsonsBlock>();
  const blocks = state.blocks.flatMap((block) => {
    const current = available.find((candidate) => !used.has(candidate) && candidate.displayText === block.displayText) ?? available.find((candidate) =>
      !used.has(candidate) && !matches.includes(candidate) && state.configFingerprint !== "student" && candidate.physicalLineIndex === block.physicalLineIndex);
    if (!current) return [];
    used.add(current);
    return [{ ...current, id: block.id, currentIndent: config.stripIndentation ? block.currentIndent : current.currentIndent }];
  });
  blocks.push(...available.filter((block) => !used.has(block)));
  return { ...state, configFingerprint, blocks, selectedBlockId: blocks.some((block) => block.id === state.selectedBlockId) ? state.selectedBlockId : null, lastEvaluation: null };
}

function hashValue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

export function projectParsonsState(value: Record<string, unknown>): Record<string, unknown> {
  const parsed = parsonsAttemptStateSchema.safeParse(value);
  if (!parsed.success) return {};
  const blocks = projectParsonsBlocks(parsed.data.blocks);
  const selected = parsed.data.blocks.findIndex((block) => block.id === parsed.data.selectedBlockId);
  return { configFingerprint: "student", blocks, hasAnswer: parsed.data.hasAnswer,
    selectedBlockId: blocks[selected]?.id ?? null, lastEvaluation: null };
}
