import type { ComponentProps, JSXElementConstructor } from "react";
import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import { ParsonsActivityView } from "@cognelo/plugin-parsons";
import { McqActivityView } from "@cognelo/plugin-mcq";
import { WebDesignCodingExerciseActivityView } from "@cognelo/plugin-web-design-coding-exercises";
import {
  api,
  type CodingExerciseExecution,
  type CodingExerciseHiddenTest,
  type ParsonsAttempt,
  type ParsonsAttemptEvaluation,
  type ParsonsAttemptState,
  type WebDesignExerciseReferenceBundle,
  type WebDesignExerciseSubmission,
  type WebDesignExerciseTest
} from "@/lib/api";

type ActivityRendererProps<T extends JSXElementConstructor<any>> = ComponentProps<T> & { groupId?: string };

function ParsonsActivityRenderer(props: ActivityRendererProps<typeof ParsonsActivityView>) {
  const { groupId, ...activityProps } = props;
  return (
    <ParsonsActivityView
      {...activityProps}
      attemptsClient={{
        ensureAttempt: async (activityId, courseId, input) => {
          const result = groupId
            ? await api.ensureGroupParsonsAttempt(courseId, groupId, activityId, input)
            : await api.ensureParsonsAttempt(courseId, activityId, input);
          return { attempt: result.attempt as ParsonsAttemptClientShape };
        },
        updateAttempt: async (activityId, courseId, input) => {
          const result = groupId
            ? await api.updateGroupParsonsAttempt(courseId, groupId, activityId, input)
            : await api.updateParsonsAttempt(courseId, activityId, input);
          return { attempt: result.attempt as ParsonsAttemptClientShape };
        }
      }}
    />
  );
}

function CodingExerciseActivityRenderer(props: ActivityRendererProps<typeof CodingExerciseActivityView>) {
  const { groupId, ...activityProps } = props;
  return (
    <CodingExerciseActivityView
      {...activityProps}
      codingClient={{
        listHiddenTests: async (courseId, activityId) => {
          const result = groupId
            ? await api.groupCodingExerciseHiddenTests(courseId, groupId, activityId)
            : await api.codingExerciseHiddenTests(courseId, activityId);
          return {
            tests: result.tests as CodingExerciseHiddenTest[],
            referenceSolution: result.referenceSolution
          };
        },
        saveHiddenTests: async (courseId, activityId, input) => {
          const result = groupId
            ? await api.saveGroupCodingExerciseHiddenTests(courseId, groupId, activityId, input)
            : await api.saveCodingExerciseHiddenTests(courseId, activityId, input);
          return {
            tests: result.tests as CodingExerciseHiddenTest[],
            referenceSolution: result.referenceSolution
          };
        },
        runCode: async (courseId, activityId, input) => {
          const result = groupId
            ? await api.runGroupCodingExercise(courseId, groupId, activityId, input)
            : await api.runCodingExercise(courseId, activityId, input);
          return { execution: result.execution as CodingExerciseExecution };
        },
        listRuns: async (courseId, activityId) => {
          const result = groupId
            ? await api.groupCodingExerciseRuns(courseId, groupId, activityId)
            : await api.codingExerciseRuns(courseId, activityId);
          return { executions: result.executions as CodingExerciseExecution[] };
        },
        submitCode: async (courseId, activityId, input) => {
          const result = groupId
            ? await api.submitGroupCodingExercise(courseId, groupId, activityId, input)
            : await api.submitCodingExercise(courseId, activityId, input);
          return { execution: result.execution as CodingExerciseExecution };
        },
        listSubmissions: async (courseId, activityId) => {
          const result = groupId
            ? await api.groupCodingExerciseSubmissions(courseId, groupId, activityId)
            : await api.codingExerciseSubmissions(courseId, activityId);
          return { executions: result.executions as CodingExerciseExecution[] };
        }
      }}
    />
  );
}

function WebDesignCodingExerciseActivityRenderer(props: ActivityRendererProps<typeof WebDesignCodingExerciseActivityView>) {
  const { groupId, ...activityProps } = props;
  return (
    <WebDesignCodingExerciseActivityView
      {...activityProps}
      webDesignClient={{
        listTests: async (courseId, activityId) => {
          const result = groupId
            ? await api.groupWebDesignExerciseTests(courseId, groupId, activityId)
            : await api.webDesignExerciseTests(courseId, activityId);
          return {
            tests: result.tests as WebDesignExerciseTest[],
            referenceBundle: result.referenceBundle as WebDesignExerciseReferenceBundle | null
          };
        },
        saveTests: async (courseId, activityId, input) => {
          const result = groupId
            ? await api.saveGroupWebDesignExerciseTests(courseId, groupId, activityId, input)
            : await api.saveWebDesignExerciseTests(courseId, activityId, input);
          return {
            tests: result.tests as WebDesignExerciseTest[],
            referenceBundle: result.referenceBundle as WebDesignExerciseReferenceBundle | null
          };
        },
        getExpectedResult: async (courseId, activityId) => {
          return groupId
            ? await api.groupWebDesignExerciseExpectedResult(courseId, groupId, activityId)
            : await api.webDesignExerciseExpectedResult(courseId, activityId);
        },
        runCode: async (courseId, activityId, input) => {
          const result = groupId
            ? await api.runGroupWebDesignExercise(courseId, groupId, activityId, input)
            : await api.runWebDesignExercise(courseId, activityId, input);
          return { submission: result.submission as WebDesignExerciseSubmission };
        },
        listRuns: async (courseId, activityId) => {
          const result = groupId
            ? await api.groupWebDesignExerciseRuns(courseId, groupId, activityId)
            : await api.webDesignExerciseRuns(courseId, activityId);
          return { submissions: result.submissions as WebDesignExerciseSubmission[] };
        },
        submitCode: async (courseId, activityId, input) => {
          const result = groupId
            ? await api.submitGroupWebDesignExercise(courseId, groupId, activityId, input)
            : await api.submitWebDesignExercise(courseId, activityId, input);
          return { submission: result.submission as WebDesignExerciseSubmission };
        },
        listSubmissions: async (courseId, activityId) => {
          const result = groupId
            ? await api.groupWebDesignExerciseSubmissions(courseId, groupId, activityId)
            : await api.webDesignExerciseSubmissions(courseId, activityId);
          return { submissions: result.submissions as WebDesignExerciseSubmission[] };
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
  mcq: McqActivityView,
  "web-design-coding-exercise": WebDesignCodingExerciseActivityRenderer
} as const;
