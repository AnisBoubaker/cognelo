import type { ComponentProps, JSXElementConstructor, ReactNode } from "react";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import { ParsonsActivityView, ParsonsManualGradingPanel } from "@cognelo/plugin-parsons";
import { McqActivityView } from "@cognelo/plugin-mcq";
import { WebDesignCodingExerciseActivityView } from "@cognelo/plugin-web-design-coding-exercises";
import {
  api,
  type CodingExerciseExecution,
  type CodingExerciseHiddenTest,
  type CourseGradebookRow,
  type ParsonsAttempt,
  type ParsonsAttemptEvaluation,
  type ParsonsAttemptState,
  type ParsonsGradebookAttempt,
  type WebDesignExerciseReferenceBundle,
  type WebDesignExerciseSubmission,
  type WebDesignExerciseTest
} from "@/lib/api";

type ActivityRendererProps<T extends JSXElementConstructor<any>> = ComponentProps<T> & {
  activityRouteCourseId?: string;
  groupId?: string;
  hasQuestionAuthoringAgent?: boolean;
};

type RenderableActivity = {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  assignment?: {
    id: string;
    metadata?: Record<string, unknown>;
  };
  activityType: {
    id: string;
    key: string;
    name: string;
    description: string;
  };
};

type SaveActivity = (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<RenderableActivity>;

type BankActivityRendererContext = {
  activity: RenderableActivity;
  activityBankId: string;
  bankActivityId: string;
  bankTitle: string;
  hasQuestionAuthoringAgent: boolean;
  locale: "en" | "fr" | "zh" | "ar";
  onSave: SaveActivity;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type ManualGradingRendererContext = {
  row: CourseGradebookRow;
  attempts: ParsonsGradebookAttempt[];
  selectedAttempt: ParsonsGradebookAttempt | null;
  selectedIndex: number;
  includeAttempts: boolean;
  loading: boolean;
  error: string;
  isSavingOverride: boolean;
  isSavingRegrade: boolean;
  onClose: () => void;
  onIncludeAttemptsChange: (includeAttempts: boolean) => void;
  onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function ParsonsActivityRenderer(props: ActivityRendererProps<typeof ParsonsActivityView>) {
  const { activityRouteCourseId, groupId, hasQuestionAuthoringAgent, ...activityProps } = props;
  const courseId = activityRouteCourseId ?? activityProps.course?.id;
  return (
    <ParsonsActivityView
      {...activityProps}
      aiGenerationClient={
        activityProps.canManage && hasQuestionAuthoringAgent && courseId
          ? {
              generate: (input) => api.generateParsonsProblem(courseId, activityProps.activity.id, input)
            }
          : undefined
      }
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
  const { activityRouteCourseId, groupId, hasQuestionAuthoringAgent, ...activityProps } = props;
  const courseId = activityRouteCourseId ?? activityProps.course?.id;
  return (
    <CodingExerciseActivityView
      {...activityProps}
      aiGenerationClient={
        activityProps.canManage && hasQuestionAuthoringAgent && courseId
          ? {
              generatePrompt: (input) => api.generateCodingExercisePrompt(courseId, activityProps.activity.id, input),
              generateSolution: (input) => api.generateCodingExerciseSolution(courseId, activityProps.activity.id, input),
              generateTests: (input) => api.generateCodingExerciseTests(courseId, activityProps.activity.id, input)
            }
          : undefined
      }
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
  const { activityRouteCourseId: _activityRouteCourseId, groupId, hasQuestionAuthoringAgent: _hasQuestionAuthoringAgent, ...activityProps } = props;
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

function McqActivityRenderer(props: ActivityRendererProps<typeof McqActivityView>) {
  const { activityRouteCourseId, groupId: _groupId, hasQuestionAuthoringAgent, ...activityProps } = props;
  const courseId = activityRouteCourseId;
  return (
    <McqActivityView
      {...activityProps}
      aiGenerationClient={
        activityProps.canManage && hasQuestionAuthoringAgent && courseId
          ? {
              generate: (input) => api.generateMcqSource(courseId, activityProps.activity.id, input)
            }
          : undefined
      }
    />
  );
}

function ParsonsBankActivityRenderer(context: BankActivityRendererContext) {
  return (
    <ParsonsActivityView
      activity={context.activity}
      canManage
      course={{ id: context.activityBankId, title: context.bankTitle }}
      onSave={context.onSave}
      attemptsClient={undefined}
      t={context.t}
      locale={context.locale}
      aiGenerationClient={
        context.hasQuestionAuthoringAgent
          ? {
              generate: (input) => api.generateBankParsonsProblem(context.activityBankId, context.bankActivityId, input)
            }
          : undefined
      }
    />
  );
}

function CodingExerciseBankActivityRenderer(context: BankActivityRendererContext) {
  return (
    <CodingExerciseActivityView
      activity={context.activity}
      canManage
      course={{ id: context.activityBankId, title: context.bankTitle }}
      onSave={context.onSave}
      locale={context.locale}
      codingClient={{
        listHiddenTests: async (_courseId, activityId) => api.bankCodingExerciseHiddenTests(context.activityBankId, activityId),
        saveHiddenTests: async (_courseId, activityId, input) => api.saveBankCodingExerciseHiddenTests(context.activityBankId, activityId, input),
        runCode: async () => {
          throw new Error(context.t("bankActivityPage.runUnavailable"));
        },
        listRuns: async () => ({ executions: [] }),
        submitCode: async () => {
          throw new Error(context.t("bankActivityPage.submitUnavailable"));
        },
        listSubmissions: async () => ({ executions: [] })
      }}
      aiGenerationClient={
        context.hasQuestionAuthoringAgent
          ? {
              generatePrompt: (input) => api.generateBankCodingExercisePrompt(context.activityBankId, context.bankActivityId, input),
              generateSolution: (input) => api.generateBankCodingExerciseSolution(context.activityBankId, context.bankActivityId, input),
              generateTests: (input) => api.generateBankCodingExerciseTests(context.activityBankId, context.bankActivityId, input)
            }
          : undefined
      }
    />
  );
}

function McqBankActivityRenderer(context: BankActivityRendererContext) {
  return (
    <McqActivityView
      activity={context.activity}
      canManage
      aiGenerationClient={
        context.hasQuestionAuthoringAgent
          ? {
              generate: (input) => api.generateBankMcqSource(context.activityBankId, context.bankActivityId, input)
            }
          : undefined
      }
      onSave={context.onSave}
      locale={context.locale}
    />
  );
}

function WebDesignCodingExerciseBankActivityRenderer(context: BankActivityRendererContext) {
  return (
    <WebDesignCodingExerciseActivityView
      activity={context.activity}
      canManage
      course={{ id: context.activityBankId }}
      onSave={context.onSave}
      locale={context.locale}
      webDesignClient={{
        listTests: async (_courseId, activityId) => api.bankWebDesignExerciseTests(context.activityBankId, activityId),
        saveTests: async (_courseId, activityId, input) => api.saveBankWebDesignExerciseTests(context.activityBankId, activityId, input),
        getExpectedResult: async (_courseId, activityId) => api.bankWebDesignExerciseExpectedResult(context.activityBankId, activityId),
        runCode: async () => {
          throw new Error(context.t("bankActivityPage.runUnavailable"));
        },
        listRuns: async () => ({ submissions: [] }),
        submitCode: async () => {
          throw new Error(context.t("bankActivityPage.submitUnavailable"));
        },
        listSubmissions: async () => ({ submissions: [] })
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
      event?: { type: "move" | "indent" | "reset" | "check" | "submit"; payload?: Record<string, unknown> };
      result?: ParsonsAttemptEvaluation;
      submit?: boolean;
      complete?: boolean;
      abandon?: boolean;
    }
  ) => Promise<{ attempt: ParsonsAttemptClientShape }>;
};

export const activityRenderers = {
  "coding-exercise": CodingExerciseActivityRenderer,
  "parsons-problem": ParsonsActivityRenderer,
  mcq: McqActivityRenderer,
  "web-design-coding-exercise": WebDesignCodingExerciseActivityRenderer
} as const;

export const bankActivityRenderers: Record<string, (context: BankActivityRendererContext) => ReactNode> = {
  "coding-exercise": CodingExerciseBankActivityRenderer,
  "parsons-problem": ParsonsBankActivityRenderer,
  mcq: McqBankActivityRenderer,
  "web-design-coding-exercise": WebDesignCodingExerciseBankActivityRenderer
};

export const manualGradingRenderers: Record<string, (context: ManualGradingRendererContext) => ReactNode> = {
  "parsons-manual-grading": (context) => <ParsonsManualGradingPanel {...context} />
};

export function getManualGradingRenderer(activityTypeKey: string) {
  const rendererKey = getActivityDefinition(activityTypeKey)?.manualGrading?.rendererKey;
  return rendererKey ? manualGradingRenderers[rendererKey] ?? null : null;
}
