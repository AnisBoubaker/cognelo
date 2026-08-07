import type { ComponentProps, ComponentType, JSXElementConstructor, ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getActivityDefinition } from "@cognelo/activity-sdk";
import { CodingExerciseActivityView } from "@cognelo/plugin-coding-exercises";
import {
  CodingHomeworkGraderActivityView,
  CodingHomeworkManualGradingPanel,
  createCodingHomeworkGraderClient,
  type CodingHomeworkGradebookAttemptRecord
} from "@cognelo/plugin-coding-homework-grader";
import {
  createParsonsClient,
  ParsonsActivityView,
  ParsonsManualGradingPanel,
  type ParsonsAttemptRecord,
  type ParsonsGradebookAttemptRecord
} from "@cognelo/plugin-parsons";
import {
  createMcqClient,
  MarkdownBlocksView,
  McqActivityView,
  McqManualGradingPanel,
  parseMcqSource,
  type McqSubmission
} from "@cognelo/plugin-mcq";
import { WebDesignCodingExerciseActivityView } from "@cognelo/plugin-web-design-coding-exercises";
import { TestActivityView, type TestStudentItemRendererContext } from "@/components/test-activity-view";
import { TestManualGradingPanel } from "@/components/test-manual-grading-panel";
import { respondentsForMcqChoice, type TestReviewAllItemContext } from "@/lib/test-review-all";
import {
  api,
  apiAbsoluteUrl,
  apiRequest,
  type CodingExerciseExecution,
  type CodingExerciseHiddenTest,
  type CourseGradebookRow,
  type CourseTestAttemptReview,
  type WebDesignExerciseReferenceBundle,
  type WebDesignExerciseSubmission,
  type WebDesignExerciseTest
} from "@/lib/api";

type ActivityRendererProps<T extends JSXElementConstructor<any>> = ComponentProps<T> & {
  activityRouteCourseId?: string;
  groupId?: string;
  hasQuestionAuthoringAgent?: boolean;
  onSubmitted?: () => void;
  showReleasedAnswers?: boolean;
  releasedMaxScore?: number;
  studentViewMode?: "attempt" | "previous";
  onNewAttemptAvailabilityChange?: (canStartNewAttempt: boolean) => void;
  onPreviousSubmissionsAvailabilityChange?: (hasPreviousSubmissions: boolean) => void;
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
  activityConfig?: Record<string, unknown>;
  locale: "en" | "fr" | "zh" | "ar";
  attempts: Array<ParsonsGradebookAttemptRecord | McqSubmission | CodingHomeworkGradebookAttemptRecord | CourseTestAttemptReview>;
  selectedAttempt: ParsonsGradebookAttemptRecord | McqSubmission | CodingHomeworkGradebookAttemptRecord | CourseTestAttemptReview | null;
  selectedIndex: number;
  includeAttempts: boolean;
  loading: boolean;
  error: string;
  readOnly?: boolean;
  isSavingOverride: boolean;
  isSavingRegrade: boolean;
  isSavingDelete: boolean;
  onClose: () => void;
  onIncludeAttemptsChange: (includeAttempts: boolean) => void;
  onSelectAttemptIndex: (index: number) => void;
  onOverrideGrade: (input: { score: number; maxScore: number; reason: string | null; feedbackText?: string | null }) => Promise<void>;
  onRegradeAttempt: () => Promise<void>;
  onDeleteSubmission: () => Promise<void>;
  onGradeTestItem?: (parentAttemptId: string, testItemId: string, score: number, reason: string | null) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function isAttemptAvailability(value: unknown): value is { canStart: boolean; reason: string | null } {
  return Boolean(value && typeof value === "object" && "canStart" in value && typeof (value as { canStart?: unknown }).canStart === "boolean");
}

function ParsonsActivityRenderer(props: ActivityRendererProps<typeof ParsonsActivityView>) {
  const {
    activityRouteCourseId,
    groupId,
    hasQuestionAuthoringAgent,
    onSubmitted: _onSubmitted,
    showReleasedAnswers: _showReleasedAnswers,
    releasedMaxScore: _releasedMaxScore,
    studentViewMode,
    onNewAttemptAvailabilityChange,
    onPreviousSubmissionsAvailabilityChange,
    ...activityProps
  } = props;
  const courseId = activityRouteCourseId ?? activityProps.course?.id;
  const parsonsClient = useMemo(() => createParsonsClient(apiRequest), []);
  const aiGenerationClient = useMemo(
    () =>
      activityProps.canManage && hasQuestionAuthoringAgent && courseId
        ? {
            generate: (input: { description: string; language: string; locale: "en" | "fr" | "zh" | "ar" }) =>
              parsonsClient.generate(courseId, activityProps.activity.id, input)
          }
        : undefined,
    [activityProps.activity.id, activityProps.canManage, courseId, hasQuestionAuthoringAgent, parsonsClient]
  );
  const attemptsClient = useMemo(
    () => ({
      ensureAttempt: async (activityId: string, courseId: string, input?: { forceNew?: boolean }) => {
        const result = groupId
          ? await parsonsClient.ensureGroupAttempt(courseId, groupId, activityId, input)
          : await parsonsClient.ensureAttempt(courseId, activityId, input);
        const attemptAvailability =
          "attemptAvailability" in result && isAttemptAvailability(result.attemptAvailability) ? result.attemptAvailability : undefined;
        return { attempt: result.attempt, attemptAvailability };
      },
      listSubmissions: groupId ? async (activityId: string, courseId: string) => parsonsClient.groupSubmissions(courseId, groupId, activityId) : undefined,
      updateAttempt: async (
        activityId: string,
        courseId: string,
        input: {
          attemptId: string;
          state?: Parameters<typeof parsonsClient.updateAttempt>[2]["state"];
          event?: Parameters<typeof parsonsClient.updateAttempt>[2]["event"];
          result?: Parameters<typeof parsonsClient.updateAttempt>[2]["result"];
          submit?: boolean;
          complete?: boolean;
          abandon?: boolean;
        }
      ) => {
        const result = groupId
          ? await parsonsClient.updateGroupAttempt(courseId, groupId, activityId, input)
          : await parsonsClient.updateAttempt(courseId, activityId, input);
        return { attempt: result.attempt };
      }
    }),
    [groupId, parsonsClient]
  );
  return (
    <ParsonsActivityView
      {...activityProps}
      aiGenerationClient={aiGenerationClient}
      attemptsClient={attemptsClient}
      onNewAttemptAvailabilityChange={onNewAttemptAvailabilityChange}
      onPreviousSubmissionsAvailabilityChange={onPreviousSubmissionsAvailabilityChange}
      studentViewMode={studentViewMode}
    />
  );
}

function CodingExerciseActivityRenderer(props: ActivityRendererProps<typeof CodingExerciseActivityView>) {
  const {
    activityRouteCourseId,
    groupId,
    hasQuestionAuthoringAgent,
    onSubmitted: _onSubmitted,
    showReleasedAnswers: _showReleasedAnswers,
    releasedMaxScore: _releasedMaxScore,
    studentViewMode: _studentViewMode,
    onNewAttemptAvailabilityChange: _onNewAttemptAvailabilityChange,
    onPreviousSubmissionsAvailabilityChange: _onPreviousSubmissionsAvailabilityChange,
    ...activityProps
  } = props;
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

function CodingHomeworkGraderActivityRenderer(props: ActivityRendererProps<typeof CodingHomeworkGraderActivityView>) {
  const {
    activityRouteCourseId,
    groupId,
    hasQuestionAuthoringAgent: _hasQuestionAuthoringAgent,
    onSubmitted: _onSubmitted,
    showReleasedAnswers: _showReleasedAnswers,
    releasedMaxScore: _releasedMaxScore,
    studentViewMode: _studentViewMode,
    onNewAttemptAvailabilityChange: _onNewAttemptAvailabilityChange,
    onPreviousSubmissionsAvailabilityChange: _onPreviousSubmissionsAvailabilityChange,
    ...activityProps
  } = props;
  const courseId = activityRouteCourseId ?? activityProps.course?.id;
  const codingHomeworkClient = useMemo(() => createCodingHomeworkGraderClient(apiRequest), []);
  const authoringClient = useMemo(() => {
    if (!activityProps.canManage || !courseId) {
      return undefined;
    }
    return {
      get: (activityId: string) => codingHomeworkClient.getCourseAuthoring(courseId, activityId),
      createDocumentationSnapshot: (activityId: string) =>
        groupId
          ? codingHomeworkClient.createGroupDocumentationSnapshot(courseId, groupId, activityId)
          : codingHomeworkClient.createCourseDocumentationSnapshot(courseId, activityId),
      getDocumentationPreview: (activityId: string) =>
        groupId
          ? codingHomeworkClient.previewGroupDocumentation(courseId, groupId, activityId)
          : codingHomeworkClient.previewCourseDocumentation(courseId, activityId),
      extractDocumentation: (activityId: string, input?: { snapshotId?: string | null }) =>
        groupId
          ? codingHomeworkClient.extractGroupDocumentation(courseId, groupId, activityId, input)
          : codingHomeworkClient.extractCourseDocumentation(courseId, activityId, input),
      importRequirements: (activityId: string, input: Parameters<typeof codingHomeworkClient.importCourseRequirements>[2]) =>
        codingHomeworkClient.importCourseRequirements(courseId, activityId, input),
      save: (activityId: string, input: Parameters<typeof codingHomeworkClient.saveCourseAuthoring>[2]) =>
        codingHomeworkClient.saveCourseAuthoring(courseId, activityId, input),
      deleteProvidedFile: (activityId: string, attachmentId: string) =>
        codingHomeworkClient.deleteCourseProvidedFile(courseId, activityId, attachmentId),
      uploadProvidedFile: (activityId: string, input: Parameters<typeof codingHomeworkClient.uploadCourseProvidedFile>[2]) =>
        codingHomeworkClient.uploadCourseProvidedFile(courseId, activityId, input),
      uploadAssignmentPdf: (activityId: string, input: Parameters<typeof codingHomeworkClient.uploadCourseAssignmentPdf>[2]) =>
        codingHomeworkClient.uploadCourseAssignmentPdf(courseId, activityId, input)
    };
  }, [activityProps.canManage, codingHomeworkClient, courseId, groupId]);
  const preflightClient = useMemo(() => {
    if (!courseId) {
      return undefined;
    }
    return {
      run: (activityId: string, input: Parameters<typeof codingHomeworkClient.runCoursePreflight>[2]) =>
        groupId ? codingHomeworkClient.runGroupPreflight(courseId, groupId, activityId, input) : codingHomeworkClient.runCoursePreflight(courseId, activityId, input)
    };
  }, [codingHomeworkClient, courseId, groupId]);
  const submissionClient = useMemo(() => {
    if (!courseId || !groupId) {
      return undefined;
    }
    return {
      getAssignment: (activityId: string) => codingHomeworkClient.getGroupStudentAssignment(courseId, groupId, activityId),
      getLatestSubmission: (activityId: string) => codingHomeworkClient.getGroupSubmission(courseId, groupId, activityId),
      saveAnswers: (activityId: string, input: Parameters<typeof codingHomeworkClient.saveGroupChallengeAnswers>[3]) =>
        codingHomeworkClient.saveGroupChallengeAnswers(courseId, groupId, activityId, input),
      submit: (activityId: string, input: Parameters<typeof codingHomeworkClient.submitGroupSubmission>[3]) =>
        codingHomeworkClient.submitGroupSubmission(courseId, groupId, activityId, input),
      submitAnswers: (activityId: string, input: Parameters<typeof codingHomeworkClient.submitGroupChallengeAnswers>[3]) =>
        codingHomeworkClient.submitGroupChallengeAnswers(courseId, groupId, activityId, input)
    };
  }, [codingHomeworkClient, courseId, groupId]);
  return (
    <CodingHomeworkGraderActivityView
      {...activityProps}
      activityFileUrl={(attachmentId) =>
        apiAbsoluteUrl(
          groupId
            ? `/courses/${courseId}/groups/${groupId}/activities/assigned/${activityProps.activity.id}/coding-homework-grader/activity-file?attachmentId=${encodeURIComponent(attachmentId)}`
            : `/courses/${courseId}/activities/${activityProps.activity.id}/coding-homework-grader/activity-file?attachmentId=${encodeURIComponent(attachmentId)}`
        )
      }
      authoringClient={authoringClient}
      preflightClient={preflightClient}
      submissionClient={submissionClient}
    />
  );
}

function WebDesignCodingExerciseActivityRenderer(props: ActivityRendererProps<typeof WebDesignCodingExerciseActivityView>) {
  const {
    activityRouteCourseId: _activityRouteCourseId,
    groupId,
    hasQuestionAuthoringAgent: _hasQuestionAuthoringAgent,
    onSubmitted: _onSubmitted,
    showReleasedAnswers: _showReleasedAnswers,
    releasedMaxScore: _releasedMaxScore,
    studentViewMode: _studentViewMode,
    onNewAttemptAvailabilityChange: _onNewAttemptAvailabilityChange,
    onPreviousSubmissionsAvailabilityChange: _onPreviousSubmissionsAvailabilityChange,
    ...activityProps
  } = props;
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
  const {
    activityRouteCourseId,
    groupId,
    hasQuestionAuthoringAgent,
    onSubmitted,
    showReleasedAnswers,
    releasedMaxScore,
    studentViewMode,
    onNewAttemptAvailabilityChange,
    onPreviousSubmissionsAvailabilityChange,
    ...activityProps
  } = props;
  const courseId = activityRouteCourseId;
  const mcqClient = createMcqClient(apiRequest);
  return (
    <McqActivityView
      {...activityProps}
      submissionClient={
        courseId && groupId
          ? {
              getStatus: async (activityId) => mcqClient.groupSubmissionStatus(courseId, groupId, activityId),
              submit: async (activityId, answers) => {
                const result = await mcqClient.submitGroup(courseId, groupId, activityId, { answers });
                return { submission: result.submission };
              }
            }
          : undefined
      }
      onSubmitted={onSubmitted}
      showCorrectAnswers={Boolean(showReleasedAnswers)}
      releasedMaxScore={releasedMaxScore}
      studentViewMode={studentViewMode}
      onNewAttemptAvailabilityChange={onNewAttemptAvailabilityChange}
      onPreviousSubmissionsAvailabilityChange={onPreviousSubmissionsAvailabilityChange}
      aiGenerationClient={
        activityProps.canManage && hasQuestionAuthoringAgent && courseId
          ? {
              generate: (input) => mcqClient.generate(courseId, activityProps.activity.id, input)
            }
          : undefined
      }
    />
  );
}

type TestItemRendererProps = TestStudentItemRendererContext;

function McqTestItemRenderer({ executionHost, runtime, item }: TestItemRendererProps) {
  const submissionClient = useMemo(() => ({
    getStatus: async () => {
      const savedState = await executionHost.load();
      const itemAttempt = item.itemAttempt;
      const answers = asStudentAnswers(savedState?.answers);
      const completed = itemAttempt?.lifecycle === "submitted" || itemAttempt?.lifecycle === "graded";
      return {
        submission: itemAttempt ? { answers, lifecycle: itemAttempt.lifecycle } : null,
        // A compound Test exposes one released parent grade. Child scores remain
        // private here and are shown only through the released Test breakdown.
        grade: null,
        availability: {
          attemptsRemaining: completed ? 0 : 1,
          canStart: !completed && runtime.attempt?.lifecycle === "started",
          reason: completed ? "This Test activity has already been submitted." : null
        }
      };
    },
    save: async (_activityId: string, answers: Record<string, string[]>) => {
      await executionHost.save({ answers });
    }
  }), [executionHost, item.itemAttempt, runtime.attempt]);

  return (
    <McqActivityView
      activity={{
        ...item.activity,
        assignment: {
          metadata: { assessmentMode: "summative" }
        }
      }}
      canManage={false}
      onSave={async () => item.activity}
      submissionClient={submissionClient}
      deferSubmission
      autosaveDelayMs={0}
      showCorrectAnswers={false}
      studentViewMode={runtime.attempt?.lifecycle === "started" ? "attempt" : "previous"}
    />
  );
}

const testItemRenderers: Record<string, ComponentType<TestItemRendererProps>> = {
  mcq: McqTestItemRenderer
};

type TestReviewItem = CourseTestAttemptReview["items"][number];

function McqTestGradebookReview({ item }: { item: TestReviewItem }) {
  const submissionClient = useMemo(() => ({
    getStatus: async () => ({
      submission: { answers: asStudentAnswers(item.itemAttempt.state.answers), lifecycle: item.itemAttempt.lifecycle },
      grade: item.itemAttempt.rawScore !== null && item.itemAttempt.rawMaxScore !== null ? {
        rawScore: item.itemAttempt.rawScore,
        rawMaxScore: item.itemAttempt.rawMaxScore,
        normalizedScore: item.itemAttempt.normalizedScore ?? undefined,
        normalizedMaxScore: item.itemAttempt.normalizedMaxScore ?? undefined
      } : null,
      availability: { attemptsRemaining: 0, canStart: false, reason: null }
    })
  }), [item.itemAttempt]);

  return (
    <McqActivityView
      activity={{ ...item.activity, assignment: { metadata: { assessmentMode: "summative" } } }}
      canManage={false}
      onSave={async () => item.activity}
      submissionClient={submissionClient}
      deferSubmission
      showCorrectAnswers
      studentViewMode="previous"
    />
  );
}

const testGradebookReviewRenderers: Record<string, ComponentType<{ item: TestReviewItem }>> = {
  mcq: McqTestGradebookReview
};

function McqTestReviewAll({ item, responses, t }: TestReviewAllItemContext) {
  const source = typeof item.activity.config?.source === "string" ? item.activity.config.source : "";
  const defaultCodeLanguage = typeof item.activity.config?.defaultCodeLanguage === "string" ? item.activity.config.defaultCodeLanguage : "none";
  const parsed = parseMcqSource(source, defaultCodeLanguage);

  return (
    <div className="stack">
      {parsed.introBlocks.length ? <MarkdownBlocksView blocks={parsed.introBlocks} /> : null}
      {parsed.questions.map((question, questionIndex) => (
        <article className="stack" key={question.id} style={{ border: "1px solid rgba(13, 27, 71, 0.08)", borderRadius: 12, padding: 18 }}>
          <div className="stack stack-tight">
            <p className="eyebrow">Question {questionIndex + 1}</p>
            <h3>{question.title}</h3>
            <MarkdownBlocksView blocks={question.promptBlocks} />
          </div>
          <div className="stack stack-tight">
            {question.choices.map((choice) => {
              const students = respondentsForMcqChoice(responses, question.id, choice.id);
              const studentNames = students.map((student) => `${student.participantName} (${student.groupTitle})`);
              return (
                <div
                  key={choice.id}
                  style={{
                    alignItems: "flex-start",
                    background: choice.isCorrect ? "rgba(34, 197, 94, 0.08)" : undefined,
                    border: choice.isCorrect ? "1px solid rgba(22, 163, 74, 0.28)" : "1px solid rgba(13, 27, 71, 0.12)",
                    borderRadius: 10,
                    display: "flex",
                    gap: 12,
                    padding: 12
                  }}
                >
                  <span
                    aria-label={t(choice.isCorrect ? "courseDetail.correctAnswer" : "courseDetail.incorrectAnswer")}
                    style={{ color: choice.isCorrect ? "#15803d" : "#64748b", flex: "0 0 auto", fontWeight: 900 }}
                  >
                    {choice.isCorrect ? "✓" : "○"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}><MarkdownBlocksView blocks={choice.blocks} compact /></span>
                  {students.length ? (
                    <TestReviewChoiceBadge
                      students={students}
                      studentNames={studentNames}
                      ariaLabel={t("courseDetail.choiceSelectedBy", { count: students.length, names: studentNames.join(", ") })}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

function TestReviewChoiceBadge({
  students,
  studentNames,
  ariaLabel
}: {
  students: TestReviewAllItemContext["responses"];
  studentNames: string[];
  ariaLabel: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16, width: 190 });

  useLayoutEffect(() => {
    if (!open) return;
    function placeTooltip() {
      const anchor = anchorRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !tooltip) return;
      const margin = 16;
      const gap = 8;
      const anchorRect = anchor.getBoundingClientRect();
      const width = Math.min(320, Math.max(160, window.innerWidth - margin * 2));
      const tooltipHeight = tooltip.getBoundingClientRect().height;
      const left = Math.min(
        Math.max(margin, anchorRect.right - width),
        Math.max(margin, window.innerWidth - width - margin)
      );
      const above = anchorRect.top - tooltipHeight - gap;
      const below = anchorRect.bottom + gap;
      const top = above >= margin
        ? above
        : Math.min(below, Math.max(margin, window.innerHeight - tooltipHeight - margin));
      setPosition({ left, top, width });
    }
    placeTooltip();
    window.addEventListener("resize", placeTooltip);
    window.addEventListener("scroll", placeTooltip, true);
    return () => {
      window.removeEventListener("resize", placeTooltip);
      window.removeEventListener("scroll", placeTooltip, true);
    };
  }, [open, studentNames.length]);

  return (
    <>
      <span
        aria-label={ariaLabel}
        className="test-review-choice-count"
        ref={anchorRef}
        tabIndex={0}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {students.length}
      </span>
      {open && typeof document !== "undefined" ? createPortal(
        <span
          className="test-review-choice-students"
          ref={tooltipRef}
          role="tooltip"
          style={{ left: position.left, top: position.top, width: position.width }}
        >
          {studentNames.map((name, index) => <span key={students[index].participantId}>{name}</span>)}
        </span>,
        document.body
      ) : null}
    </>
  );
}

const testReviewAllRenderers: Record<string, ComponentType<TestReviewAllItemContext>> = {
  mcq: McqTestReviewAll
};

export function renderTestReviewAllItem(context: TestReviewAllItemContext) {
  const Renderer = testReviewAllRenderers[context.item.activityTypeKey];
  return Renderer ? <Renderer {...context} /> : null;
}

function TestActivityRenderer(props: ActivityRendererProps<typeof TestActivityView>) {
  return (
    <TestActivityView
      {...props}
      renderStudentItem={(context) => {
        const Renderer = testItemRenderers[context.item.activity.activityType.key];
        return Renderer ? (
          <Renderer
            {...context}
          />
        ) : null;
      }}
    />
  );
}

function asStudentAnswers(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([questionId, choiceIds]) =>
      Array.isArray(choiceIds) && choiceIds.every((choiceId) => typeof choiceId === "string")
        ? [[questionId, choiceIds as string[]]]
        : []
    )
  );
}

function ParsonsBankActivityRenderer(context: BankActivityRendererContext) {
  const parsonsClient = createParsonsClient(apiRequest);
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
              generate: (input) => parsonsClient.generateBank(context.activityBankId, context.bankActivityId, input)
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

function CodingHomeworkGraderBankActivityRenderer(context: BankActivityRendererContext) {
  const codingHomeworkClient = useMemo(() => createCodingHomeworkGraderClient(apiRequest), []);
  const authoringClient = useMemo(
    () => ({
      get: (activityId: string) => codingHomeworkClient.getBankAuthoring(context.activityBankId, activityId),
      importRequirements: (activityId: string, input: Parameters<typeof codingHomeworkClient.importBankRequirements>[2]) =>
        codingHomeworkClient.importBankRequirements(context.activityBankId, activityId, input),
      save: (activityId: string, input: Parameters<typeof codingHomeworkClient.saveBankAuthoring>[2]) =>
        codingHomeworkClient.saveBankAuthoring(context.activityBankId, activityId, input),
      deleteProvidedFile: (activityId: string, attachmentId: string) =>
        codingHomeworkClient.deleteBankProvidedFile(context.activityBankId, activityId, attachmentId),
      uploadProvidedFile: (activityId: string, input: Parameters<typeof codingHomeworkClient.uploadBankProvidedFile>[2]) =>
        codingHomeworkClient.uploadBankProvidedFile(context.activityBankId, activityId, input),
      uploadAssignmentPdf: (activityId: string, input: Parameters<typeof codingHomeworkClient.uploadBankAssignmentPdf>[2]) =>
        codingHomeworkClient.uploadBankAssignmentPdf(context.activityBankId, activityId, input)
    }),
    [codingHomeworkClient, context.activityBankId]
  );
  return (
    <CodingHomeworkGraderActivityView
      activity={context.activity}
      activityFileUrl={(attachmentId) =>
        apiAbsoluteUrl(
          `/activity-banks/${context.activityBankId}/activities/${context.activity.id}/coding-homework-grader/activity-file?attachmentId=${encodeURIComponent(attachmentId)}`
        )
      }
      canManage
      locale={context.locale}
      onSave={context.onSave}
      authoringClient={authoringClient}
    />
  );
}

function McqBankActivityRenderer(context: BankActivityRendererContext) {
  const mcqClient = createMcqClient(apiRequest);
  return (
    <McqActivityView
      activity={context.activity}
      canManage
      aiGenerationClient={
        context.hasQuestionAuthoringAgent
          ? {
              generate: (input) => mcqClient.generateBank(context.activityBankId, context.bankActivityId, input)
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

export const activityRenderers = {
  test: TestActivityRenderer,
  "coding-exercise": CodingExerciseActivityRenderer,
  "coding-homework-grader": CodingHomeworkGraderActivityRenderer,
  "parsons-problem": ParsonsActivityRenderer,
  mcq: McqActivityRenderer,
  "web-design-coding-exercise": WebDesignCodingExerciseActivityRenderer
} as const;

export const bankActivityRenderers: Record<string, (context: BankActivityRendererContext) => ReactNode> = {
  "coding-exercise": CodingExerciseBankActivityRenderer,
  "coding-homework-grader": CodingHomeworkGraderBankActivityRenderer,
  "parsons-problem": ParsonsBankActivityRenderer,
  mcq: McqBankActivityRenderer,
  "web-design-coding-exercise": WebDesignCodingExerciseBankActivityRenderer
};

export const manualGradingRenderers: Record<string, (context: ManualGradingRendererContext) => ReactNode> = {
  "test-manual-grading": (context) => (
    <TestManualGradingPanel
      {...context}
      attempts={context.attempts as CourseTestAttemptReview[]}
      selectedAttempt={context.selectedAttempt as CourseTestAttemptReview | null}
      readOnly={Boolean(context.readOnly)}
      onGradeTestItem={context.onGradeTestItem ?? (async () => undefined)}
      renderItemReview={(item) => {
        const Renderer = testGradebookReviewRenderers[item.activityTypeKey];
        return Renderer ? <Renderer item={item} /> : null;
      }}
    />
  ),
  "parsons-manual-grading": (context) => (
    <ParsonsManualGradingPanel
      {...context}
      attempts={context.attempts as ParsonsGradebookAttemptRecord[]}
      selectedAttempt={context.selectedAttempt as ParsonsGradebookAttemptRecord | null}
    />
  ),
  "mcq-manual-grading": (context) => (
    <McqManualGradingPanel {...context} attempts={context.attempts as McqSubmission[]} selectedAttempt={context.selectedAttempt as McqSubmission | null} />
  ),
  "coding-homework-grader-manual-grading": (context) => (
    <CodingHomeworkManualGradingPanel
      {...context}
      attempts={context.attempts as CodingHomeworkGradebookAttemptRecord[]}
      selectedAttempt={context.selectedAttempt as CodingHomeworkGradebookAttemptRecord | null}
    />
  )
};

export function getManualGradingRenderer(activityTypeKey: string) {
  const rendererKey = getActivityDefinition(activityTypeKey)?.manualGrading?.rendererKey;
  return rendererKey ? manualGradingRenderers[rendererKey] ?? null : null;
}
