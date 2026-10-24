import type { SubmissionExportHandler } from "./submission-export";
export * from "./submission-export";
import type { CurrentUser } from "@cognelo/contracts";
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
  path: string;
  activityTypeKeys?: readonly string[];
  courseAuthorization?: Partial<Record<PluginRouteMethod, CoursePluginRouteAuthorization>>;
  allowExpiredTimedAttemptMethods?: readonly Exclude<PluginRouteMethod, "GET">[];
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

export type PluginAiFeedbackResult = {
  feedbackRef: string;
  feedbackVersion: number;
  feedbackHash: string;
  feedback: Record<string, unknown>;
  gradingResult?: PluginGradingResult;
};

export type PluginAiGradingTemplate = {
  coreAttemptId: string;
  submission: Record<string, unknown>;
  feedback: Record<string, unknown>;
};

export type PluginAiGradingBatchGuidance = {
  instructions: string;
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
}) => Promise<PluginAiFeedbackResult>;

export type PluginAiFeedbackTeacherReviewContext = {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  pluginAttemptRef?: string | null;
  activity: ServerActivityRecord;
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

export type PluginAiGradingBatchHandler = {
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
  /** Null preserves submitted work awaiting teacher/rubric grading. */
  gradingResult: PluginGradingResult | null;
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

export type ServerActivityPlugin = {
  key: string;
  /** Read-only projection of a host-authorized submitted attempt. */
  submissionExport?: { activityTypeKeys: readonly string[]; getContent: SubmissionExportHandler };
  studentSolution?: {
    activityTypeKeys: readonly string[];
    /** Called only after the host authorizes solution release. Never return grading secrets. */
    getSolution: (activity: ServerActivityRecord) => Promise<ActivitySolutionContent | null>;
  };
  /** Restores learner-owned state inside the host's atomic reopening transaction.
   * SQL remains owned by the plugin; the SDK has no dependency on a Prisma client. */
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
  aiFeedback?: {
    evaluateAttempt: PluginAiFeedbackHandler;
    teacherReview?: PluginAiFeedbackTeacherReviewHandler;
    batchGrading?: PluginAiGradingBatchHandler;
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

export function resolvePluginAiFeedbackHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.aiFeedback?.evaluateAttempt && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.aiFeedback?.evaluateAttempt ?? null;
}

export function resolvePluginAiFeedbackTeacherReviewHandler(activityTypeKey: string) {
  return currentServerPlugins().find((plugin) =>
    plugin.aiFeedback?.teacherReview && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.aiFeedback?.teacherReview ?? null;
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
