import { z } from "zod";

export const AiGradingRunCreateSchema = z.object({
  attemptIds: z.array(z.string().min(1)).min(1).max(500),
  instructions: z.string().trim().min(1).max(8000).optional(),
  templateAttemptIds: z.array(z.string().min(1)).max(3).optional()
}).strict();
export const AiGradingRunActionSchema = z.object({ action: z.enum(["heartbeat", "cancel", "interrupt", "keep", "discard", "finish"]) }).strict();
export type AiGradingRunSummary = {
  id: string;
  activityId: string;
  status: "running" | "review" | "completed" | "discarded";
  stopReason: string | null;
  completed: number;
  total: number;
  students: Array<{ attemptId: string; name: string; status: "pending" | "processing" | "completed" | "failed"; error: string | null }>;
};
