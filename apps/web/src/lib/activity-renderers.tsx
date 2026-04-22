import type { ComponentProps } from "react";
import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import { ParsonsActivityView } from "@cognelo/plugin-parsons";
import { McqActivityView } from "@cognelo/plugin-mcq";
import {
  api,
  type CodingExerciseExecution,
  type CodingExerciseHiddenTest,
  type ParsonsAttempt,
  type ParsonsAttemptEvaluation,
  type ParsonsAttemptState
} from "@/lib/api";

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

function CodingExerciseActivityRenderer(props: ComponentProps<typeof CodingExerciseActivityView>) {
  return (
    <CodingExerciseActivityView
      {...props}
      codingClient={{
        listHiddenTests: async (courseId, activityId) => {
          const result = await api.codingExerciseHiddenTests(courseId, activityId);
          return {
            tests: result.tests as CodingExerciseHiddenTest[],
            referenceSolution: result.referenceSolution
          };
        },
        saveHiddenTests: async (courseId, activityId, input) => {
          const result = await api.saveCodingExerciseHiddenTests(courseId, activityId, input);
          return {
            tests: result.tests as CodingExerciseHiddenTest[],
            referenceSolution: result.referenceSolution
          };
        },
        runCode: async (courseId, activityId, input) => {
          const result = await api.runCodingExercise(courseId, activityId, input);
          return { execution: result.execution as CodingExerciseExecution };
        },
        listRuns: async (courseId, activityId) => {
          const result = await api.codingExerciseRuns(courseId, activityId);
          return { executions: result.executions as CodingExerciseExecution[] };
        },
        submitCode: async (courseId, activityId, input) => {
          const result = await api.submitCodingExercise(courseId, activityId, input);
          return { execution: result.execution as CodingExerciseExecution };
        },
        listSubmissions: async (courseId, activityId) => {
          const result = await api.codingExerciseSubmissions(courseId, activityId);
          return { executions: result.executions as CodingExerciseExecution[] };
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
  "coding-exercise": CodingExerciseActivityRenderer,
  "parsons-problem": ParsonsActivityRenderer,
  mcq: McqActivityView
} as const;
