import { z } from "zod";

export const AiGradingRunCreateSchema = z.object({
  attemptIds: z.array(z.string().min(1)).min(1).max(500),
  instructions: z.string().trim().min(1).max(8000).optional(),
  actionId: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  templateAttemptIds: z.array(z.string().min(1)).max(3).optional()
}).strict();
const localizedText = z.record(z.string(), z.string().min(1).max(2000)).refine(value => typeof value.en === "string");
export const AiGradingActionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(80), labels: localizedText, messages: localizedText,
  participantMessages: localizedText.optional(),
  attemptIds: z.array(z.string().min(1)).min(1).max(500)
}).strict();
export type AiGradingAction = z.infer<typeof AiGradingActionSchema>;
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
