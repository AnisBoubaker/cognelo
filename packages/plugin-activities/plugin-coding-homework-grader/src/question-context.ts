export const QUESTION_CONTEXT_LIMIT = 24_000;
export type StudentQuestionContext = { code: string; filePath: string | null; functionName: string | null; languageKey: string; truncated: boolean };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const bounded = (value: unknown, limit: number) => typeof value === "string" ? value.slice(0, limit) : null;

export function makeStudentQuestionContext(input: { code: string; filePath?: string | null; functionName?: string | null; languageKey?: string | null; truncated?: boolean }): StudentQuestionContext {
  return { code: input.code.slice(0, QUESTION_CONTEXT_LIMIT), filePath: bounded(input.filePath, 500), functionName: bounded(input.functionName, 160), languageKey: bounded(input.languageKey, 40) ?? "c", truncated: input.truncated === true || input.code.length > QUESTION_CONTEXT_LIMIT };
}

/** Only learner-owned submitted code; never expose ASTs, retrieval examples or arbitrary question metadata. */
export function studentQuestionContext(row: { submissionId: string; metadata?: unknown; submissionFunction?: unknown }): StudentQuestionContext | null {
  const fn = record(row.submissionFunction), file = record(fn.file);
  if (fn.submissionId === row.submissionId && file.submissionId === row.submissionId && typeof fn.functionCode === "string") {
    return makeStudentQuestionContext({ code: fn.functionCode, filePath: bounded(file.path, 500), functionName: bounded(fn.functionName, 160), languageKey: bounded(file.languageKey, 40) });
  }
  const context = record(record(row.metadata).studentCodeContext);
  if (typeof context.code !== "string") return null;
  return makeStudentQuestionContext({ code: context.code, filePath: bounded(context.filePath, 500), functionName: bounded(context.functionName, 160), languageKey: bounded(context.languageKey, 40), truncated: context.truncated === true });
}

// Existing question records already retain their submitted function, so display needs no data migration.
export const studentQuestionContextInclude = { submissionFunction: { select: {
  submissionId: true, functionCode: true, functionName: true,
  file: { select: { submissionId: true, path: true, languageKey: true } }
} } } as const;
