import type { CurrentUser } from "@cognelo/contracts";
import { codingExercisesServerPlugin } from "@cognelo/plugin-coding-exercises/server";
import { codingHomeworkGraderServerPlugin } from "@cognelo/plugin-coding-homework-grader/server";
import { parsonsServerPlugin } from "@cognelo/plugin-parsons/server";
import { placeholderServerPlugin } from "@cognelo/plugin-placeholder/server";
import { mcqServerPlugin } from "@cognelo/plugin-mcq/server";
import { webDesignCodingExercisesServerPlugin } from "@cognelo/plugin-web-design-coding-exercises/server";

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

export type PluginRouteDefinition = {
  path: string;
  activityTypeKeys?: readonly string[];
  methods: Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", PluginRouteHandler>>;
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

export type CourseActivityDeletedHook = (input: {
  user: CurrentUser;
  courseId: string;
  activityId: string;
  activityTypeKey: string;
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

export type PluginGradingHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId: string;
  activityId: string;
  coreAttemptId: string;
  pluginAttemptRef?: string | null;
  activity: ServerActivityRecord;
}) => Promise<PluginGradingResult>;

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
  gradingResult: PluginGradingResult;
}>;

export type ServerActivityPlugin = {
  key: string;
  routes?: readonly PluginRouteDefinition[];
  grading?: {
    gradeAttempt?: PluginGradingHandler;
  };
  compositeExecution?: {
    activityTypeKeys: readonly string[];
    submit: CompositeExecutionSubmissionHandler;
  };
  hooks?: {
    onCourseActivityCreatedFromBankVersion?: CourseActivityCreatedFromBankVersionHook;
    onCourseActivityDeleted?: CourseActivityDeletedHook;
    onBankActivityDeleted?: BankActivityDeletedHook;
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

const serverPlugins: readonly ServerActivityPlugin[] = [
  placeholderServerPlugin,
  codingHomeworkGraderServerPlugin,
  parsonsServerPlugin,
  mcqServerPlugin,
  codingExercisesServerPlugin,
  webDesignCodingExercisesServerPlugin
];

function normalizePath(path: string | readonly string[]) {
  const segments: readonly string[] = typeof path === "string" ? path.split("/") : path;
  return segments.map((segment: string) => segment.trim()).filter(Boolean).join("/");
}

export function resolvePluginRoute(activityTypeKey: string, path: readonly string[]) {
  const normalizedPath = normalizePath(path);

  for (const plugin of serverPlugins) {
    for (const route of plugin.routes ?? []) {
      if (normalizePath(route.path) !== normalizedPath) {
        continue;
      }
      if (route.activityTypeKeys && !route.activityTypeKeys.includes(activityTypeKey)) {
        continue;
      }
      return route;
    }
  }

  return null;
}

export function listPluginRoutes() {
  return serverPlugins.flatMap((plugin) =>
    (plugin.routes ?? []).map((route) => ({
      pluginKey: plugin.key,
      path: normalizePath(route.path),
      activityTypeKeys: route.activityTypeKeys ?? []
    }))
  );
}

export function resolvePluginGradingHandler(activityTypeKey: string) {
  return serverPlugins.find((plugin) =>
    plugin.grading?.gradeAttempt && plugin.routes?.some((route) => !route.activityTypeKeys || route.activityTypeKeys.includes(activityTypeKey))
  )?.grading?.gradeAttempt ?? null;
}

export function resolveCompositeExecutionSubmissionHandler(activityTypeKey: string) {
  return serverPlugins.find((plugin) =>
    plugin.compositeExecution?.activityTypeKeys.includes(activityTypeKey)
  )?.compositeExecution?.submit ?? null;
}

export async function runCourseActivityCreatedFromBankVersionHooks(input: {
  user: CurrentUser;
  courseId: string;
  activity: ServerActivityRecord;
  bankActivityId: string;
  activityVersionId: string;
}) {
  await runCourseActivityCreatedFromBankVersionHooksForPlugins(serverPlugins, input);
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
  await runBankActivityDeletedHooksForPlugins(serverPlugins, input);
}

export async function runCourseActivityDeletedHooks(input: {
  user: CurrentUser;
  courseId: string;
  activityId: string;
  activityTypeKey: string;
}) {
  await runCourseActivityDeletedHooksForPlugins(serverPlugins, input);
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
  await runActivityAttemptDeletedHooksForPlugins(serverPlugins, input);
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
