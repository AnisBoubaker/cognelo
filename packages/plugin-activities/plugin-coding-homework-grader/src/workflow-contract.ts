import { z } from "zod";
import { AiModelSelectionSchema } from "@cognelo/contracts";
import { homeworkSubmissionPolicySchema } from "./submission-policy";

/** Only explicitly edited operational fields join the ordinary authoring save. */
export const homeworkWorkflowDraftSchema = z.object({
  concurrency: z.number().int().min(1).max(4).optional(),
  enabled: z.boolean().optional(),
  questionGenerationAi: AiModelSelectionSchema.nullable().optional(),
  submissionPolicy: homeworkSubmissionPolicySchema.optional()
}).strict();
export type HomeworkWorkflowDraftInput = z.infer<typeof homeworkWorkflowDraftSchema>;
