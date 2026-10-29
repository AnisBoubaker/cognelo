import { z } from "zod";

export const TestItemReviewInputSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  expectedFeedbackHash: z.string().nullable(),
  feedback: z.unknown().optional(),
  feedbackText: z.string().max(10000).optional(),
  score: z.number().finite().min(0).optional(),
  useRubricScore: z.boolean().optional(),
  reason: z.string().trim().max(1000).nullable().optional()
}).strict();

export const TestAttemptReviewInputSchema = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  expectedGradeUpdatedAt: z.iso.datetime().nullable(),
  items: z.array(TestItemReviewInputSchema.extend({ testItemId: z.string().min(1) })).max(100),
  feedbackText: z.string().max(10000).optional(),
  total: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("calculated") }).strict(),
    z.object({ mode: z.literal("override"), score: z.number().finite().min(0) }).strict()
  ]).optional(),
  reason: z.string().trim().max(1000).nullable().optional()
}).strict().refine(input => Boolean(input.items.length || input.total || input.feedbackText !== undefined), "A review change is required.")
  .refine(input => new Set(input.items.map(item => item.testItemId)).size === input.items.length, "Questions must be distinct.");

export type TestItemReviewInput = z.infer<typeof TestItemReviewInputSchema>;
export type TestAttemptReviewInput = z.infer<typeof TestAttemptReviewInputSchema>;
