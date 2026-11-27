import type { GradebookActionService } from "./gradebook-actions";
export * from "./gradebook-actions";
import type { SubmissionExportHandler, StudentActivityExportHandler } from "./submission-export";
export * from "./submission-export";
import type { ActivityStudentProgress, CurrentUser, AiGradingAction, EvaluationFlag } from "@cognelo/contracts";
import type { GradingReviewRequest } from "@cognelo/contracts";
import type { ActivityLogCursor, ActivityLogEvidence, ActivityStudentActionList, ActivityBatchAction } from "@cognelo/contracts";
import type { GradebookActionContext } from "./gradebook-actions";
import type { WorkInspectionFile, WorkInspectionSection } from "@cognelo/contracts";
import type { GradebookActionParticipant } from "./gradebook-actions";
import type { ActivityDefinition, ActivitySolutionContent } from "./index";

export type ServerActivityRecord = {
  id: string;
  bankActivityId?: string | null;
  activityVersionId?: string | null;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  assignment?: {
    id: string;
    availableFrom?: Date | string | null;
    availableUntil?: Date | string | null;
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    position?: number;
  };
  activityType: {
    key: string;
    name: string;
    description: string;
  };
};

export type PluginRouteContext = {
  /** Host-selected expired attempt; never a client request field. */
  expiredTimedAttemptId?: string;
  user: CurrentUser;
  courseId?: string;
  groupId?: string;
  activityBankId?: string;
  activityId: string;
  path: string[];
  activity: ServerActivityRecord;
};

export type PluginRouteHandler = (input: {
  request: Request;
  context: PluginRouteContext;
  readJson: () => Promise<unknown>;
}) => Promise<unknown>;

export type PluginRouteMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type CoursePluginRouteAuthorization = "manage_course" | "view_gradebook";

export type PluginRouteDefinition = {
  /** Only honored for definitions opting into deferred assessment. Default routes remain guarded. */
  learnerAccessPhase?: "preparation" | "assessment_start";
  /** Declared stage owning this route. Its SEB policy applies even to preparation routes. */
  submissionStageId?: string;
  path: string;
  activityTypeKeys?: readonly string[];
  courseAuthorization?: Partial<Record<PluginRouteMethod, CoursePluginRouteAuthorization>>;
  allowExpiredTimedAttemptMethods?: readonly Exclude<PluginRouteMethod, "GET">[];
  /** Reconstruct final input from server-saved work only. Required at expiry. */
  expiredAttemptInput?: (context: PluginRouteContext) => Promise<unknown>;
  methods: Partial<Record<PluginRouteMethod, PluginRouteHandler>>;
};

export type CourseActivityCreatedFromBankVersionHook = (input: {
  user: CurrentUser;
  courseId: string;
  activity: ServerActivityRecord;
  bankActivityId: string;
  activityVersionId: string;
}) => Promise<void>;

export type BankActivityDeletedHook = (input: {
  user: CurrentUser;
  activityBankId: string;
  bankActivityId: string;
  activityTypeKey: string;
}) => Promise<void>;

export type BankActivityDuplicatedHook = (input: {
  user: CurrentUser;
  activityBankId: string;
  sourceBankActivityId: string;
  bankActivityId: string;
  activityTypeKey: string;
}) => Promise<void>;

export type ActivityVariationKnowledge = {
  mode: "selected";
  concepts: Array<{ id: string; title: string; skills: string[]; skillIds: string[]; misconceptions: string[]; misconceptionIds: string[] }>;
  selectedConcepts: Array<{ id: string; title: string; skills: string[]; skillIds: string[]; misconceptions: string[]; misconceptionIds: string[] }>;
};

export type BankActivityVariationProgress = {
  fraction: number;
  step: "content" | "prompt" | "solution" | "tests" | "validating" | "saving";
};

export type BankActivityVariationResult = {
  // Safe, localized review guidance only; never expose private generation artifacts.
  warnings?: Array<{ code: string; message: string }>;
};

export type BankActivityVariationHandler = (input: {
  user: CurrentUser;
  activityBankId: string;
  sourceActivity: ServerActivityRecord;
  activity: ServerActivityRecord;
  instructions: string;
  locale: "en" | "fr" | "zh" | "ar";
  subject: { title: string; description: string };
  knowledge: ActivityVariationKnowledge;
  reportProgress: (progress: BankActivityVariationProgress) => Promise<void>;
}) => Promise<void | BankActivityVariationResult>;

export type CourseActivityDeletedHook = (input: {
  user: CurrentUser;
  courseId: string;
  activityId: string;
  activityTypeKey: string;
}) => Promise<void>;

export type CourseActivityDuplicatedHook = (input: {
  user: CurrentUser;
  courseId: string;
  sourceActivityId: string;
  activity: ServerActivityRecord;
}) => Promise<void>;

export type CourseActivityPublishedToBankHook = (input: {
  user: CurrentUser;
  courseId: string;
  activity: ServerActivityRecord;
  bankActivityId: string;
  activityVersionId: string;
}) => Promise<void>;

export type ActivityAttemptDeletedHook = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  pluginAttemptRef: string | null;
  reason: string;
  deletedAt: Date | string;
}) => Promise<void>;

export type PluginGradingResult = {
  rawScore: number;
  rawMaxScore: number;
  isPass?: boolean | null;
  feedback?: Record<string, unknown>;
  analyticsPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type PluginGradingDeferredResult = {
  deferred: true;
  /** Core records the request, blocks automatic publication/release and resolves it through teacher grading. */
  reviewRequired?: GradingReviewRequest;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type PluginGradingHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  pluginAttemptRef?: string | null;
  activity: ServerActivityRecord;
}) => Promise<PluginGradingResult | PluginGradingDeferredResult>;

export type PluginStudentGradeReportHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  gradebookItemId: string;
  selectedAttemptId?: string | null;
  /** A child of the released parent Test; providers must recheck ownership and membership. */
  testItemId?: string;
}) => Promise<Record<string, unknown> | null>;

export type PluginGradeCompletion = {
  status: "complete" | "partial";
  completedComponentCount: number;
  requiredComponentCount: number;
};

export type PluginGradeCompletionRow = {
  participantId: string;
  score: number;
  gradeSource: "auto" | "manual" | "override" | "regrade" | null;
  feedback: Record<string, unknown> | null;
  gradingResult: Record<string, unknown>;
};

export type PluginGradeCompletionHandler = (input: {
  user: CurrentUser;
  courseId: string;
  activityId: string;
  rows: readonly PluginGradeCompletionRow[];
}) => Promise<Readonly<Record<string, PluginGradeCompletion>>>;

export type PluginEvaluationFlagRow = {
  participantId: string; groupId: string; attemptId: string; pluginAttemptRef: string | null;
  feedback: Record<string, unknown> | null; gradingResult: Record<string, unknown>;
};
export type PluginEvaluationFlagHandler = (input: {
  user: CurrentUser; courseId: string; activityId: string; rows: readonly PluginEvaluationFlagRow[];
}) => Promise<Readonly<Record<string, EvaluationFlag[]>>>;

export type PluginAiFeedbackResult = {
  feedbackRef: string;
  feedbackVersion: number;
  feedbackHash: string;
  feedback: Record<string, unknown>;
  gradingResult?: PluginGradingResult;
  preserveFinalGradeOverride?: boolean;
  synchronizeSharedGrading?: boolean;
  /** Retain assessed components on the submitted attempt while its final grade is still pending. */
  allowUngradedFeedback?: boolean;
};

export type PluginAiGradingTemplate = {
  coreAttemptId: string;
  submission: Record<string, unknown>;
  feedback: Record<string, unknown>;
};

export type PluginAiGradingBatchGuidance = {
  /** Omit for compound Tests: each question retains its own saved instructions. */
  instructions?: string;
  templates: readonly PluginAiGradingTemplate[];
};

export type PluginAiFeedbackHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  pluginAttemptRef?: string | null;
  activity: ServerActivityRecord;
  triggerKind: "teacher_single" | "teacher_selection" | "teacher_batch" | "formative_submission" | "test_child";
  testItemAttempt?: {
    id: string;
    parentAttemptId: string;
    pluginAttemptRef: string | null;
    state: Record<string, unknown>;
  };
  batchGuidance?: PluginAiGradingBatchGuidance;
  /** Keep private artifacts out of ordinary report/history queries until the host commits. */
  deferPublication?: boolean;
  /** Existing authorized feedback for component-specific assessment. */
  currentFeedback?: Record<string, unknown> | null;
}) => Promise<PluginAiFeedbackResult>;

export type PluginAiFeedbackTeacherReviewContext = {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  pluginAttemptRef?: string | null;
  activity: ServerActivityRecord;
  /** Authorized, persisted child state supplied by the Test host. */
  testItemAttempt?: NonNullable<Parameters<PluginAiFeedbackHandler>[0]["testItemAttempt"]>;
};

export type PluginAiFeedbackTeacherReviewHandler = {
  getSubmission: (input: PluginAiFeedbackTeacherReviewContext) => Promise<Record<string, unknown>>;
  createFeedbackDraft: (
    input: PluginAiFeedbackTeacherReviewContext
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  reviseFeedback: (
    input: PluginAiFeedbackTeacherReviewContext & {
      currentFeedback: Record<string, unknown>;
      feedback: unknown;
    }
  ) => Promise<{
    feedback: Record<string, unknown>;
    gradingResult?: PluginGradingResult;
  }> | {
    feedback: Record<string, unknown>;
    gradingResult?: PluginGradingResult;
  };
};

export type PluginAiGradingInstructionsContext = {
  scope: "course" | "bank";
  activityId: string;
  actorUserId: string;
  transaction: {
    query: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
    execute: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  };
};

/** Authoring access to a plugin's existing instruction field, independent of submissions. */
export type PluginAiGradingInstructionsHandler = {
  activityTypeKeys: readonly string[];
  getInstructions: (input: PluginAiGradingInstructionsContext) => Promise<string>;
  replaceInstructions: (input: PluginAiGradingInstructionsContext & { instructions: string }) => Promise<void>;
};

export type PluginAiGradingBatchHandler = {
  /** Optional bounded model evidence, separate from the lazy teacher-review UI projection. */
  getTemplateSubmission?: (input: PluginAiFeedbackTeacherReviewContext) => Promise<Record<string, unknown>>;
  getInstructions: (
    input: PluginAiFeedbackTeacherReviewContext
  ) => Promise<string> | string;
  updateInstructions: (
    input: PluginAiFeedbackTeacherReviewContext & { instructions: string }
  ) => Promise<void> | void;
  isTemplateComplete: (
    input: PluginAiFeedbackTeacherReviewContext & { feedback: Record<string, unknown> }
  ) => Promise<boolean> | boolean;
};

export type CompositeExecutionSubmissionHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  parentAttemptId: string;
  testItemId: string;
  activity: ServerActivityRecord;
  payload: unknown;
}) => Promise<{
  state: Record<string, unknown>;
  /** Immutable plugin submission evidence, independent of whether a grade is available. */
  pluginAttemptRef?: string | null;
  /** Null preserves submitted work awaiting teacher/rubric grading. */
  gradingResult: PluginGradingResult | null;
  /** A grading conflict or other uncertainty requiring a human decision; detailed evidence remains plugin-owned. */
  reviewRequired?: GradingReviewRequest;
}>;

export type CompositeExecutionActionHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  parentAttemptId: string;
  testItemId: string;
  activity: ServerActivityRecord;
  payload: unknown;
}) => Promise<unknown>;

/** Reuses immutable submission evidence when a plugin has a dedicated rerun path.
 * user is the learner; actor is the authorized teacher requesting the regrade. */
export type CompositeExecutionRegradingHandler = (input: Parameters<CompositeExecutionSubmissionHandler>[0] & {
  actor: CurrentUser;
  feedback: Record<string, unknown>;
  previousConfig: unknown;
}) => ReturnType<CompositeExecutionSubmissionHandler>;

export type StudentPreviewExecutionHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activity: ServerActivityRecord;
  payload: unknown;
}) => Promise<unknown>;

export type PluginHostCapabilityHandler<TResult = unknown> = () => Promise<TResult> | TResult;

export type PreparedActivityMaterialReferences = {
  id: string;
  selected: string[];
  indexIds: string[];
  hiddenReferenceIndexIds: string[];
  embeddingAi: Record<string, unknown> | null;
  preparedByUserId: string;
  preparedAt: string;
  selectionFingerprint: string;
};
export type ActivityMaterialReferencesState = { selected: string[] | null; prepared: PreparedActivityMaterialReferences | null; locked: boolean; revision: string };
export type ActivityMaterialReferencesService = {
  activityTypeKeys: readonly string[];
  /** Acquire the plugin's reference/settings lock when called inside the supplied transaction. */
  read: (input: { user: CurrentUser; courseId: string; activityId: string; transaction: PluginTeamworkTransaction }) => Promise<ActivityMaterialReferencesState>;
  write: (input: { user: CurrentUser; courseId: string; activityId: string; selected: string[]; prepared?: Omit<PreparedActivityMaterialReferences, "id">; transaction: PluginTeamworkTransaction }) => Promise<void>;
};

export type SubmissionStageActivationScope = {
  user: CurrentUser;
  courseId: string;
  activityId: string;
  /** Any configured General/assigned-section/exception activation, excluding unavailable stages. */
  enabled: Record<string, boolean>;
};
export type SubmissionStageActivationChange = SubmissionStageActivationScope & {
  prepared: unknown;
  transaction: PluginTeamworkTransaction;
  /** Resolve current enrollment and inherited activation inside the host transaction. */
  isEnabled: (input: { groupId: string; userId: string; stageId: string }) => Promise<boolean>;
  enqueue: (job: { queue: string; handlerKey: string; payload: Record<string, unknown>; metadata?: Record<string, unknown>; idempotencyKey?: string; maxAttempts?: number; runAfter?: Date }) => Promise<void>;
};

export type WorkInspectionContext = {
  user: CurrentUser; courseId: string; activity: ServerActivityRecord;
  participant: GradebookActionParticipant; assignmentMetadata: unknown;
  /** Generic server-saved draft or current Test-item response, never a submission/grading request. */
  state: Record<string, unknown> | null; embedded: boolean;
};
export type ServerActivityPlugin = {
  key: string;
  workInspection?: {
    activityTypeKeys: readonly string[];
    read: (context: WorkInspectionContext) => Promise<{ sections: WorkInspectionSection[]; savedAt?: string | null }>;
    readFile?: (context: WorkInspectionContext & { key: string }) => Promise<WorkInspectionFile>;
  };
  reports?: {
    activityTypeKeys: readonly string[];
    /** Read-only, newest-first lifecycle evidence. Never expose raw plugin metadata. */
    logs?: (context: GradebookActionContext & { before?: ActivityLogCursor; limit: number }) => Promise<ActivityLogEvidence[]>;
    studentActions?: {
      list: (context: GradebookActionContext & { recoverAutomatic: boolean }) => Promise<ActivityStudentActionList>;
      execute: (context: GradebookActionContext & { actionId: string; targetId: string; reason: string }) => Promise<void>;
    };
    activityActions?: {
      list: (context: GradebookActionContext) => Promise<ActivityBatchAction[]>;
      /** Must revalidate the revision and publish the operation receipt atomically with its changes. */
      execute: (context: GradebookActionContext & { actionId: string; reason: string; revision: string; operationId: string; requestHash: string }) => Promise<{ affectedCount: number }>;
    };
  };
  /** Batch, read-only projection. Host supplies only its authorized student roster. */
  studentProgress?: {
    activityTypeKeys: readonly string[];
    getProgress: (input: {
      user: CurrentUser;
      courseId: string;
      activityId: string;
      activityMetadata: unknown;
      assignmentMetadata: Record<string, unknown>;
      participants: Array<{ participantId: string; groupId: string; userId: string | null }>;
      /** Core lifecycle/timing projection; plugins may refine saved-response evidence. */
      progress?: readonly ActivityStudentProgress[];
    }) => Promise<ActivityStudentProgress[]>;
  };
  materialReferences?: ActivityMaterialReferencesService;
  submissionStages?: {
    activityTypeKeys: readonly string[];
    /** Legacy defaults and enabled stages; no plugin-private records cross this boundary. */
    configuration: (input: { activityId: string }) => Promise<{ activeStageIds?: string[]; defaults?: Record<string, { enabled?: boolean; deadline?: string | null; timeLimitMinutes?: number | null; allowLate?: boolean; lateLimitMinutes?: number | null }> }>;
    /** Read-only readiness validation before the host opens its settings transaction. */
    prepareActivation?: (input: Omit<SubmissionStageActivationScope, "enabled">) => Promise<unknown>;
    /** Persist plugin locks and release waiting work atomically with core settings. */
    activationChanged?: (input: SubmissionStageActivationChange) => Promise<void>;
  };
  /** Private workspace lifecycle, invoked by core without knowing plugin tables. */
  teamwork?: {
    activityTypeKeys: readonly string[];
    hasActiveSubmissions: (input: { activityId: string; groupId?: string; transaction: PluginTeamworkTransaction }) => Promise<boolean>;
    membershipChanged: (input: {
      user: CurrentUser; courseId: string; groupId: string; groupingId: string; activityId: string;
      assignment?: { groupingId: string; allowIndividualSubmission: boolean } | null;
      changes: Array<{ participantId: string; userId: string | null; previousTeamId: string | null; teamId: string | null; removed?: boolean }>;
      emptyTeamIds: string[];
      groupingRemoved?: boolean;
      membershipToken: string;
      teamWorkspaceEpochs: Record<string, string>;
      transaction: PluginTeamworkTransaction;
      enqueue: (job: { queue: string; handlerKey: string; payload: Record<string, unknown>; metadata?: Record<string, unknown>; idempotencyKey?: string; maxAttempts?: number; runAfter?: Date }) => Promise<void>;
    }) => Promise<{ withdrawAttemptIds?: string[] }>;
  };
  /** Read-only projection of a host-authorized submitted attempt. */
  gradebookActions?: GradebookActionService;
  submissionExport?: { activityTypeKeys: readonly string[]; getContent: SubmissionExportHandler };
  /** Explicit learner-safe projection; teacher export handlers are never a fallback. */
  studentExport?: { activityTypeKeys: readonly string[]; getContent: StudentActivityExportHandler };
  studentSolution?: {
    activityTypeKeys: readonly string[];
    /** Called only after the host authorizes solution release. Never return grading secrets. */
    getSolution: (activity: ServerActivityRecord) => Promise<ActivitySolutionContent | null>;
  };
  /** Restores learner-owned state inside the host's atomic reopening transaction.
   * SQL remains owned by the plugin; the SDK has no dependency on a Prisma client. */
  timedFinalization?: {
    activityTypeKeys: readonly string[];
    finalize: (input: { user: CurrentUser; courseId: string; groupId: string; activityId: string; coreAttemptId: string }) => Promise<boolean>;
  };
  attemptContinuation?: {
    activityTypeKeys: readonly string[];
    reopen: (input: {
      activityId: string;
      userId: string | null;
      pluginAttemptRef: string | null;
      metadata: Record<string, unknown>;
      transaction: {
        query: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
        execute: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
      };
    }) => Promise<{ responseState?: Record<string, unknown>; audit?: Record<string, unknown> }>;
  };
  hostCapabilities?: Readonly<Record<string, PluginHostCapabilityHandler>>;
  routes?: readonly PluginRouteDefinition[];
  grading?: {
    gradeAttempt?: PluginGradingHandler;
  };
  studentGradeReport?: {
    activityTypeKeys: readonly string[];
    getReport: PluginStudentGradeReportHandler;
  };
  gradeCompletion?: {
    activityTypeKeys: readonly string[];
    getCompletions: PluginGradeCompletionHandler;
  };
  /** Read-only staff flags. Core owns scope, validation and display, including ungraded submissions. */
  evaluationFlags?: { activityTypeKeys: readonly string[]; getFlags: PluginEvaluationFlagHandler };
  /** Publish a shared component and project it onto current related submissions.
   * Core validates each target and records ordinary audited grades in the same transaction. */
  sharedGrading?: {
    synchronize: (input: {
      activityId: string; groupId: string; pluginAttemptRef: string; feedback: Record<string, unknown>;
      transaction: {
        query: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
        execute: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
      };
    }) => Promise<Array<{ attemptId: string; component: Record<string, unknown>; revision: string; policyHash?: string }>>;
    mergeFeedback: (feedback: Record<string, unknown>, component: Record<string, unknown>, revision: string, policyHash?: string) => {
      feedback: Record<string, unknown>; gradingResult?: PluginGradingResult;
    };
  };
  aiGradingInstructions?: PluginAiGradingInstructionsHandler;
  aiFeedback?: {
    evaluateAttempt: PluginAiFeedbackHandler;
    publishEvaluation?: (input: {
      activityId: string;
      coreAttemptId: string;
      feedbackRef: string;
      transaction: { execute: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number> };
    }) => Promise<void>;
    teacherReview?: PluginAiFeedbackTeacherReviewHandler;
    batchGrading?: PluginAiGradingBatchHandler;
    additionalActions?: {
      list: (input: { user: CurrentUser; courseId: string; activityId: string;
        attempts: Array<{ id: string; groupId: string; pluginAttemptRef: string | null }> }) => Promise<AiGradingAction[]>;
      evaluate: (input: Parameters<PluginAiFeedbackHandler>[0] & { actionId: string }) => Promise<PluginAiFeedbackResult>;
    };
  };
  compositeExecution?: {
    activityTypeKeys: readonly string[];
    submit: CompositeExecutionSubmissionHandler;
    regrade?: CompositeExecutionRegradingHandler;
    actions?: Readonly<Record<string, CompositeExecutionActionHandler>>;
  };
  /** Stateless execution only. Handlers registered here must not write learner,
   * attempt, grade, analytics, or plugin execution records. */
  studentPreview?: {
    activityTypeKeys: readonly string[];
    actions: Readonly<Record<string, StudentPreviewExecutionHandler>>;
  };
  bankVariation?: {
    activityTypeKeys: readonly string[];
    createVariation: BankActivityVariationHandler;
  };
  hooks?: {
    onCourseActivityCreatedFromBankVersion?: CourseActivityCreatedFromBankVersionHook;
    onCourseActivityDeleted?: CourseActivityDeletedHook;
    onCourseActivityDuplicated?: CourseActivityDuplicatedHook;
    onCourseActivityPublishedToBank?: CourseActivityPublishedToBankHook;
    onBankActivityDeleted?: BankActivityDeletedHook;
    onBankActivityDuplicated?: BankActivityDuplicatedHook;
    onActivityAttemptDeleted?: ActivityAttemptDeletedHook;
  };
};

export type PluginTeamworkTransaction = {
  /** Core-owned completion of already-frozen deferred work within this transaction; never a learner endpoint. */
  recordDeferredSubmission?: (input: { userId: string; courseId: string; groupId: string; activityId: string; pluginKey: string; pluginVersion: string; pluginAttemptRef: string; submittedAt: string; metadata?: Record<string, unknown> }) => Promise<{ id: string }>;
  query: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  execute: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

export function getActivityMaterialReferencesHandler(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.materialReferences?.activityTypeKeys.includes(activityTypeKey))?.materialReferences ?? null;
}

export function getActivityTeamworkHandler(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.teamwork?.activityTypeKeys.includes(activityTypeKey))?.teamwork ?? null;
}

export function getAssignedGroupActivityAttemptSource(context: PluginRouteContext) {
  if (!context.courseId || !context.groupId) {
    throw new Error("Assigned group activity attempts require course and group route context.");
  }

  return {
    courseId: context.courseId,
    groupId: context.groupId,
    activityId: context.activityId
  };
}

const serverPluginsByKey = new Map<string, ServerActivityPlugin>();

export function registerServerActivityPlugin(plugin: ServerActivityPlugin) {
  for (const route of plugin.routes ?? []) {
    if (!route.activityTypeKeys?.length) {
      throw new Error(`Plugin route must declare activity type keys: ${plugin.key}/${normalizePath(route.path)}`);
    }
    for (const [method, authorization] of Object.entries(route.courseAuthorization ?? {})) {
      if (!route.methods[method as PluginRouteMethod]) {
        throw new Error(`Plugin route authorization has no matching handler: ${plugin.key}/${normalizePath(route.path)} (${method})`);
      }
      if (authorization === "view_gradebook" && method !== "GET") {
        throw new Error(`Gradebook-read plugin authorization is limited to GET routes: ${plugin.key}/${normalizePath(route.path)} (${method})`);
      }
    }
  }
  serverPluginsByKey.set(plugin.key, plugin);
}

export function registerServerActivityPlugins(plugins: readonly ServerActivityPlugin[]) {
  for (const plugin of plugins) registerServerActivityPlugin(plugin);
}

function currentServerPlugins(): readonly ServerActivityPlugin[] {
  return [...serverPluginsByKey.values()];
}

export function validateStudentPreviewServerContracts(
  definitions: readonly Pick<ActivityDefinition, "key" | "studentView">[],
  plugins: readonly ServerActivityPlugin[]
) {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const previewPluginByActivityType = new Map<string, string>();

  for (const plugin of plugins) {
    const preview = plugin.studentPreview;
    if (!preview) continue;
    if (!Object.keys(preview.actions).length) {
      throw new Error(`Student view server registration has no actions: ${plugin.key}`);
    }
    for (const activityTypeKey of preview.activityTypeKeys) {
      const definition = definitionsByKey.get(activityTypeKey);
      if (!definition) {
        throw new Error(`Student view server registration references an unknown activity type: ${activityTypeKey}`);
      }
      if (definition.studentView.mode !== "interactive" || definition.studentView.execution !== "plugin") {
        throw new Error(`Activity type cannot register plugin Student view actions: ${activityTypeKey}`);
      }
      const existingPlugin = previewPluginByActivityType.get(activityTypeKey);
      if (existingPlugin) {
        throw new Error(`Activity type has duplicate Student view server registrations: ${activityTypeKey} (${existingPlugin}, ${plugin.key})`);
      }
      previewPluginByActivityType.set(activityTypeKey, plugin.key);
    }
  }

  for (const definition of definitions) {
    if (
      definition.studentView.mode === "interactive"
      && definition.studentView.execution === "plugin"
      && !previewPluginByActivityType.has(definition.key)
    ) {
      throw new Error(`Interactive plugin activity type is missing Student view server actions: ${definition.key}`);
    }
  }
}

export function listServerActivityPlugins() {
  return [...currentServerPlugins()];
}

export function resolveActivityStudentProgressHandler(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.studentProgress?.activityTypeKeys.includes(activityTypeKey))?.studentProgress?.getProgress ?? null;
}

export function getActivityReportService(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.reports?.activityTypeKeys.includes(activityTypeKey))?.reports ?? null;
}

export function getWorkInspectionService(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.workInspection?.activityTypeKeys.includes(activityTypeKey))?.workInspection ?? null;
}

function normalizePath(path: string | readonly string[]) {
  const segments: readonly string[] = typeof path === "string" ? path.split("/") : path;
  return segments.map((segment: string) => segment.trim()).filter(Boolean).join("/");
}

export function resolvePluginRoute(activityTypeKey: string, path: readonly string[]) {
  const normalizedPath = normalizePath(path);

  for (const plugin of currentServerPlugins()) {
    for (const route of plugin.routes ?? []) {
      if (normalizePath(route.path) !== normalizedPath) {
        continue;
      }
      if (!route.activityTypeKeys?.includes(activityTypeKey)) {
        continue;
      }
      return route;
    }
  }

  return null;
}

export function resolveCoursePluginRouteAuthorization(path: readonly string[], method: PluginRouteMethod) {
  const normalizedPath = normalizePath(path);
  const matchingRoutes = currentServerPlugins().flatMap((plugin) =>
    (plugin.routes ?? []).filter((route) => normalizePath(route.path) === normalizedPath && Boolean(route.methods[method]))
  );
  const declared = new Set(matchingRoutes.map((route) => route.courseAuthorization?.[method] ?? "manage_course"));
  if (declared.size > 1) {
    throw new Error(`Plugin routes disagree on course authorization for ${method} ${normalizedPath}.`);
  }
  return declared.values().next().value as CoursePluginRouteAuthorization | undefined;
}

export function listPluginRoutes() {
  return currentServerPlugins().flatMap((plugin) =>
    (plugin.routes ?? []).map((route) => ({
      pluginKey: plugin.key,
      path: normalizePath(route.path),
      activityTypeKeys: route.activityTypeKeys ?? []
    }))
  );
}

export function resolvePluginGradingHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.grading?.gradeAttempt && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.grading?.gradeAttempt ?? null;
}

export function resolveAttemptContinuationHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.attemptContinuation?.activityTypeKeys.includes(activityTypeKey)
  )?.attemptContinuation?.reopen ?? null;
}

export function resolvePluginStudentGradeReportHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.studentGradeReport?.activityTypeKeys.includes(activityTypeKey)
  )?.studentGradeReport?.getReport ?? null;
}

export function resolvePluginStudentSolutionHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.studentSolution?.activityTypeKeys.includes(activityTypeKey)
  )?.studentSolution?.getSolution ?? null;
}

export function resolvePluginGradeCompletionHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.gradeCompletion?.activityTypeKeys.includes(activityTypeKey)
  )?.gradeCompletion?.getCompletions ?? null;
}

export function resolvePluginEvaluationFlagHandler(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.evaluationFlags?.activityTypeKeys.includes(activityTypeKey))?.evaluationFlags?.getFlags ?? null;
}

export function resolvePluginSharedGrading(pluginKey: string) {
  return currentServerPlugins().find(plugin => plugin.key === pluginKey)?.sharedGrading ?? null;
}

export function resolvePluginAiFeedbackHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.aiFeedback?.evaluateAttempt && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.aiFeedback?.evaluateAttempt ?? null;
}

export function resolvePluginAiFeedbackPublisher(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.aiFeedback?.evaluateAttempt && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.aiFeedback?.publishEvaluation ?? null;
}

export function resolvePluginAiFeedbackAdditionalActions(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.aiFeedback?.additionalActions
    && plugin.routes?.some(route => route.activityTypeKeys?.includes(activityTypeKey)))?.aiFeedback?.additionalActions ?? null;
}

export function resolvePluginAiFeedbackTeacherReviewHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.aiFeedback?.teacherReview && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.aiFeedback?.teacherReview ?? null;
}

export function resolvePluginAiGradingInstructionsHandler(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.aiGradingInstructions?.activityTypeKeys.includes(activityTypeKey))?.aiGradingInstructions ?? null;
}

export function resolvePluginAiGradingBatchHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.aiFeedback?.batchGrading && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.aiFeedback?.batchGrading ?? null;
}

export function resolveCompositeExecutionSubmissionHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.compositeExecution?.activityTypeKeys.includes(activityTypeKey)
  )?.compositeExecution?.submit ?? null;
}

export function resolveCompositeExecutionRegradingHandler(activityTypeKey: string) {
  return [...serverPluginsByKey.values()].find((plugin) =>
    plugin.compositeExecution?.activityTypeKeys.includes(activityTypeKey)
  )?.compositeExecution?.regrade ?? null;
}

export function resolveCompositeExecutionActionHandler(activityTypeKey: string, action: string) {
  const composite = currentServerPlugins().find((plugin) =>
    plugin.compositeExecution?.activityTypeKeys.includes(activityTypeKey)
  )?.compositeExecution;
  return composite?.actions?.[action] ?? null;
}

export function resolveStudentPreviewExecutionHandler(activityTypeKey: string, action: string) {
  for (const plugin of currentServerPlugins()) {
    if (plugin.studentPreview?.activityTypeKeys.includes(activityTypeKey)) {
      return plugin.studentPreview.actions[action] ?? null;
    }
  }
  return null;
}

export function resolveBankActivityVariationHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.bankVariation?.activityTypeKeys.includes(activityTypeKey)
  )?.bankVariation?.createVariation ?? null;
}

export function resolvePluginHostCapability<TResult = unknown>(capabilityKey: string) {
  const handlers = currentServerPlugins().flatMap((plugin) => {
    const handler = plugin.hostCapabilities?.[capabilityKey];
    return handler ? [{ pluginKey: plugin.key, handler }] : [];
  });
  if (handlers.length > 1) {
    throw new Error(`Plugin host capability has multiple providers: ${capabilityKey} (${handlers.map(({ pluginKey }) => pluginKey).join(", ")})`);
  }
  return (handlers[0]?.handler ?? null) as PluginHostCapabilityHandler<TResult> | null;
}

export async function runCourseActivityCreatedFromBankVersionHooks(input: {
  user: CurrentUser;
  courseId: string;
  activity: ServerActivityRecord;
  bankActivityId: string;
  activityVersionId: string;
}) {
  await runCourseActivityCreatedFromBankVersionHooksForPlugins(currentServerPlugins(), input);
}

export async function runCourseActivityCreatedFromBankVersionHooksForPlugins(
  plugins: readonly ServerActivityPlugin[],
  input: {
    user: CurrentUser;
    courseId: string;
    activity: ServerActivityRecord;
    bankActivityId: string;
    activityVersionId: string;
  }
) {
  for (const plugin of plugins) {
    await plugin.hooks?.onCourseActivityCreatedFromBankVersion?.(input);
  }
}

export async function runBankActivityDeletedHooks(input: {
  user: CurrentUser;
  activityBankId: string;
  bankActivityId: string;
  activityTypeKey: string;
}) {
  await runBankActivityDeletedHooksForPlugins(currentServerPlugins(), input);
}

export async function runCourseActivityDeletedHooks(input: {
  user: CurrentUser;
  courseId: string;
  activityId: string;
  activityTypeKey: string;
}) {
  await runCourseActivityDeletedHooksForPlugins(currentServerPlugins(), input);
}

export async function runCourseActivityDuplicatedHooks(input: {
  user: CurrentUser;
  courseId: string;
  sourceActivityId: string;
  activity: ServerActivityRecord;
}) {
  for (const plugin of currentServerPlugins()) {
    await plugin.hooks?.onCourseActivityDuplicated?.(input);
  }
}

export async function runCourseActivityPublishedToBankHooks(input: Parameters<CourseActivityPublishedToBankHook>[0]) {
  for (const plugin of currentServerPlugins()) {
    await plugin.hooks?.onCourseActivityPublishedToBank?.(input);
  }
}

export async function runCourseActivityDeletedHooksForPlugins(
  plugins: readonly ServerActivityPlugin[],
  input: {
    user: CurrentUser;
    courseId: string;
    activityId: string;
    activityTypeKey: string;
  }
) {
  for (const plugin of plugins) {
    await plugin.hooks?.onCourseActivityDeleted?.(input);
  }
}

export async function runBankActivityDeletedHooksForPlugins(
  plugins: readonly ServerActivityPlugin[],
  input: {
    user: CurrentUser;
    activityBankId: string;
    bankActivityId: string;
    activityTypeKey: string;
  }
) {
  for (const plugin of plugins) {
    await plugin.hooks?.onBankActivityDeleted?.(input);
  }
}

export async function runBankActivityDuplicatedHooks(input: Parameters<BankActivityDuplicatedHook>[0]) {
  return runBankActivityDuplicatedHooksForPlugins(currentServerPlugins(), input);
}

export async function runBankActivityDuplicatedHooksForPlugins(
  plugins: readonly ServerActivityPlugin[],
  input: Parameters<BankActivityDuplicatedHook>[0]
) {
  for (const plugin of plugins) {
    await plugin.hooks?.onBankActivityDuplicated?.(input);
  }
}

export async function runActivityAttemptDeletedHooks(input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  pluginKey: string;
  coreAttemptId: string;
  pluginAttemptRef: string | null;
  reason: string;
  deletedAt: Date | string;
}) {
  await runActivityAttemptDeletedHooksForPlugins(currentServerPlugins(), input);
}

export async function runActivityAttemptDeletedHooksForPlugins(
  plugins: readonly ServerActivityPlugin[],
  input: {
    user: CurrentUser;
    courseId: string;
    groupId: string;
    activityId: string;
    pluginKey: string;
    coreAttemptId: string;
    pluginAttemptRef: string | null;
    reason: string;
    deletedAt: Date | string;
  }
) {
  const plugin = plugins.find((candidate) => candidate.key === input.pluginKey);
  await plugin?.hooks?.onActivityAttemptDeleted?.(input);
}

export function getSubmissionExportHandler(activityTypeKey: string): SubmissionExportHandler | null {
  return currentServerPlugins().find((plugin) => plugin.submissionExport?.activityTypeKeys.includes(activityTypeKey))?.submissionExport?.getContent ?? null;
}

export function getStudentActivityExportHandler(activityTypeKey: string): StudentActivityExportHandler | null {
  return currentServerPlugins().find(plugin => plugin.studentExport?.activityTypeKeys.includes(activityTypeKey))?.studentExport?.getContent ?? null;
}

export function resolveActivityTimedFinalization(activityTypeKey: string) {
  return listServerActivityPlugins().find(plugin => plugin.timedFinalization?.activityTypeKeys.includes(activityTypeKey))?.timedFinalization?.finalize ?? null;
}

export function getActivitySubmissionStagesHandler(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.submissionStages?.activityTypeKeys.includes(activityTypeKey))?.submissionStages ?? null;
}

export function getGradebookActionService(activityTypeKey: string) {
  return currentServerPlugins().find(plugin => plugin.gradebookActions?.activityTypeKeys.includes(activityTypeKey))?.gradebookActions ?? null;
}

/** Complete graph validation; run after composition, not during partial development hot reload. */
export function validateGradebookActionServerContracts(definitions: readonly Pick<ActivityDefinition, "key" | "gradebookActions">[], plugins: readonly ServerActivityPlugin[]) {
  for (const definition of definitions) {
    const services = plugins.flatMap(plugin => plugin.gradebookActions?.activityTypeKeys.includes(definition.key) ? [plugin.gradebookActions] : []);
    if (definition.gradebookActions?.length && (services.length !== 1 || typeof services[0]?.availability !== "function" || typeof services[0]?.execute !== "function")) throw new Error(`Gradebook actions require one server service: ${definition.key}`);
    if (!definition.gradebookActions?.length && services.length) throw new Error(`Gradebook action service has no declared actions: ${definition.key}`);
  }
  for (const plugin of plugins) if (plugin.gradebookActions) {
    const keys = plugin.gradebookActions.activityTypeKeys;
    if (!keys.length || new Set(keys).size !== keys.length || keys.some(key => !definitions.some(definition => definition.key === key))) throw new Error(`Invalid gradebook action activity types: ${plugin.key}`);
  }
}
