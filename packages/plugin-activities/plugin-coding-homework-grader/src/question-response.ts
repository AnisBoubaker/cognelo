import { excludesProvidedFunction } from "./provided-code";

export function parseChallengeQuestionResponse(output: string, context: { targetFunction?: string | null; excludedNames: string[]; previousQuestions: string[] }) {
  let value: unknown;
  try { value = JSON.parse(output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
  catch { return { ok: false as const, reason: "invalid_json", feedback: 'Return only a JSON object with a string "questionText" field.' }; }
  const text = value && typeof value === "object" && "questionText" in value ? value.questionText : undefined;
  if (typeof text !== "string" || text.trim().length < 20 || text.length > 3000) return { ok: false as const, reason: "invalid_question", feedback: 'Return one complete question in "questionText" (20–3000 characters), answerable in 2–3 sentences.' };
  if (context.previousQuestions.includes(text.trim())) return { ok: false as const, reason: "duplicate", feedback: "This question repeats an earlier question. Choose a different focused point in the current submitted function." };
  if (excludesProvidedFunction(text, context.excludedNames, context.targetFunction)) return { ok: false as const, reason: "provided_function_target", feedback: `Focus on the eligible submitted function${context.targetFunction ? ` ${context.targetFunction}` : " in the code context"}. Start by naming it if mentioning a provided helper. You may ask how this submitted function calls a helper or checks its result; do not ask about the unchanged helper's internal implementation.` };
  return { ok: true as const, text: text.trim() };
}
