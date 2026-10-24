import { z } from "zod";
export const AnswerExportRequestSchema = z.object({
  participantIds: z.array(z.string().min(1).max(120)).min(1).max(500),
  attemptId: z.string().min(1).max(120).optional(),
  attempts: z.enum(["latest", "all"]).default("latest"),
  includePrompt: z.boolean().default(true),
  includeGrading: z.boolean().default(false),
  format: z.enum(["pdf", "zip"]).default("pdf"),
  groupId: z.string().min(1).max(120).optional(),
  locale: z.enum(["en", "fr", "zh", "ar"]).default("en")
}).strict().refine((value) => !value.attemptId || value.participantIds.length === 1, { message: "An exact attempt must belong to one selected student." });
export type AnswerExportRequest = z.infer<typeof AnswerExportRequestSchema>;
export type AnswerExportStudent = { participantId: string; name: string; email: string; groupId: string; groupTitle: string;
  attempts: Array<{ id: string; attemptNumber: number; submittedAt: string | null; assessmentMode: string }> };
