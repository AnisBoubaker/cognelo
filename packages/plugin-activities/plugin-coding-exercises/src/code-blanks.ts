import { z } from "zod";

export const codingBlankAnswersSchema = z.record(
  z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/), z.string().max(10000)
).refine(answers => Object.keys(answers).length <= 50 && Object.values(answers).join("").length <= 60000,
  "Use at most 50 blanks and 60,000 answer characters.");

export type CodingBlankAnswers = z.infer<typeof codingBlankAnswersSchema>;
export const codingBlankGradingSchema = z.object({
  policy: z.literal("isolated-blanks-v1"), method: z.enum(["empty", "combined", "isolated"]),
  total: z.number().int().min(1).max(50), answered: z.number().int().min(0).max(50), correct: z.number().int().min(0).max(50),
  combinedPassed: z.boolean(), syntaxPassed: z.boolean().nullable(),
  outcomes: z.array(z.object({ id: z.string(), number: z.number().int().min(1).max(50), fileName: z.string().optional(), answered: z.boolean(), correct: z.boolean() })).max(50)
});
export type CodingBlankGrading = z.infer<typeof codingBlankGradingSchema>;
export type CodingBlankOutcome = CodingBlankGrading["outcomes"][number];
export type CodingBlankPart = { kind: "code"; text: string } | { kind: "blank"; id: string };

export function codingBlankAnswer(answers: CodingBlankAnswers, id: string): string {
  return Object.hasOwn(answers, id) ? answers[id] : "";
}

/** Parse once: answer text is never interpreted as another template marker. */
export function parseCodingBlankTemplate(template: string): CodingBlankPart[] {
  const pattern = /\{\{\s*BLANK:([a-zA-Z][a-zA-Z0-9_-]{0,79})\s*\}\}/g;
  const parts: CodingBlankPart[] = [];
  const ids = new Set<string>();
  let offset = 0;
  for (const match of template.matchAll(pattern)) {
    const text = template.slice(offset, match.index);
    if (/\{\{\s*BLANK\b/.test(text)) throw new Error("Invalid code blank marker.");
    if (ids.has(match[1])) throw new Error("Each code blank must have a unique identifier.");
    ids.add(match[1]);
    parts.push({ kind: "code", text }, { kind: "blank", id: match[1] });
    offset = match.index + match[0].length;
  }
  const text = template.slice(offset);
  if (/\{\{\s*BLANK\b/.test(text)) throw new Error("Invalid code blank marker.");
  if (ids.size > 50) throw new Error("Use at most 50 code blanks.");
  parts.push({ kind: "code", text });
  return parts;
}

export function codingBlankIds(template: string) {
  return parseCodingBlankTemplate(template).flatMap(part => part.kind === "blank" ? [part.id] : []);
}

export function assembleCodingBlankSource(template: string, answers: CodingBlankAnswers): string {
  const source = parseCodingBlankTemplate(template).map(part => part.kind === "code" ? part.text : codingBlankAnswer(answers, part.id)).join("");
  if (source.length > 60000) throw new Error("The completed code exceeds 60,000 characters.");
  return source;
}

export type CodingBlankResponse = { blankTemplate: string; blankAnswers: CodingBlankAnswers };

export function readCodingBlankResponse(value: unknown): CodingBlankResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.blankTemplate !== "string" || record.blankTemplate.length > 40000) return null;
  const answers = codingBlankAnswersSchema.safeParse(record.blankAnswers);
  if (!answers.success) return null;
  return { blankTemplate: record.blankTemplate, blankAnswers: answers.data };
}

/** Used by every learner execution path; caller-supplied surrounding code is ignored. */
export function resolveCodingBlankInput<T extends { sourceCode: string; blankAnswers?: CodingBlankAnswers; blankTemplate?: string }>(
  config: { responseMode?: string; blankTemplate?: string }, input: T
): T {
  if (config.responseMode !== "blanks") {
    const result = { ...input };
    delete result.blankAnswers;
    delete result.blankTemplate;
    return result;
  }
  const template = config.blankTemplate ?? "";
  const ids = codingBlankIds(template);
  if (!ids.length) throw new Error("Add at least one code blank before running this exercise.");
  // Untouched Test questions and expired attempts may have no saved state at all.
  const untouched = input.blankTemplate === undefined && input.blankAnswers === undefined && !input.sourceCode.trim();
  if (!untouched && input.blankTemplate !== template) throw new Error("The code template has changed. Reload the exercise before running or submitting.");
  const answers = codingBlankAnswersSchema.parse(input.blankAnswers ?? {});
  if (Object.keys(answers).some(id => !ids.includes(id))) throw new Error("The answer contains an unknown code blank.");
  const blankAnswers = Object.fromEntries(ids.map(id => [id, codingBlankAnswer(answers, id)]));
  const answered = Object.values(blankAnswers).some(value => value.trim().length > 0);
  return { ...input, blankTemplate: template, blankAnswers,
    sourceCode: answered ? assembleCodingBlankSource(template, blankAnswers) : "" };
}

export function codingBlankResponseState(template: string, answers: CodingBlankAnswers) {
  return resolveCodingBlankInput({ responseMode: "blanks", blankTemplate: template },
    { sourceCode: "", blankTemplate: template, blankAnswers: answers });
}
