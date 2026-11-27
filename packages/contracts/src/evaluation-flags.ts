import { z } from "zod";

/** Staff-only review signals, independent of scores and grade-release gates. */
export const EvaluationFlagSchema = z.object({
  kind: z.literal("possible_unauthorized_assistance"),
  reasonCode: z.string().min(1).max(100),
  messages: z.object({ en: z.string().min(1).max(2000), fr: z.string().max(2000).optional(), zh: z.string().max(2000).optional(), ar: z.string().max(2000).optional() }).strict()
}).strict();
export type EvaluationFlag = z.infer<typeof EvaluationFlagSchema>;
