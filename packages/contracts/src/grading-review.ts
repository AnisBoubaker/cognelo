import { z } from "zod";

/** Plugins supply a plain staff-facing reason and an optional opaque private evidence reference. */
export const GradingReviewRequestSchema = z.object({
  reasonCode: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/),
  message: z.string().trim().min(1).max(2000),
  evidenceRef: z.string().trim().min(1).max(200).optional()
}).strict();
export type GradingReviewRequest = z.infer<typeof GradingReviewRequestSchema>;

export type GradingReview = {
  id: string; attemptId: string; testItemAttemptId: string | null;
  status: "required" | "resolved"; reasonCode: string; message: string; version: number;
  requestedAt: string; resolvedAt: string | null;
};
