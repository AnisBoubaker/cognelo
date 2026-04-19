import type { ComponentProps } from "react";
import { ParsonsActivityView } from "@cognelo/plugin-parsons";
import { api, type ParsonsAttempt, type ParsonsAttemptEvaluation, type ParsonsAttemptState } from "@/lib/api";

function ParsonsActivityRenderer(props: ComponentProps<typeof ParsonsActivityView>) {
  return (
    <ParsonsActivityView
      {...props}
      attemptsClient={{
        ensureAttempt: async (activityId, courseId, input) => {
          const result = await api.ensureParsonsAttempt(courseId, activityId, input);
          return { attempt: result.attempt as ParsonsAttemptClientShape };
        },
        updateAttempt: async (activityId, courseId, input) => {
          const result = await api.updateParsonsAttempt(courseId, activityId, input);
          return { attempt: result.attempt as ParsonsAttemptClientShape };
        }
      }}
    />
  );
}

type ParsonsAttemptClientShape = ParsonsAttempt & {
  latestState: ParsonsAttemptState;
  resultSummary: Record<string, unknown>;
};

export type ParsonsAttemptsClient = {
  ensureAttempt: (activityId: string, courseId: string, input?: { forceNew?: boolean }) => Promise<{ attempt: ParsonsAttemptClientShape }>;
  updateAttempt: (
    activityId: string,
    courseId: string,
    input: {
      attemptId: string;
      state?: ParsonsAttemptState;
      event?: { type: "move" | "indent" | "reset" | "check"; payload?: Record<string, unknown> };
      result?: ParsonsAttemptEvaluation;
      complete?: boolean;
      abandon?: boolean;
    }
  ) => Promise<{ attempt: ParsonsAttemptClientShape }>;
};

export const activityRenderers = {
  "parsons-problem": ParsonsActivityRenderer
} as const;
