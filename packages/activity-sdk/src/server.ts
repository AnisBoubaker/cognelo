import type { CurrentUser } from "@cognelo/contracts";
import { codingExercisesServerPlugin } from "@cognelo/plugin-coding-exercises/server";
import { homeworkGraderServerPlugin } from "@cognelo/plugin-homework-grader/server";
import { parsonsServerPlugin } from "@cognelo/plugin-parsons/server";
import { placeholderServerPlugin } from "@cognelo/plugin-placeholder/server";
import { mcqServerPlugin } from "@cognelo/plugin-mcq/server";
import { webDesignCodingExercisesServerPlugin } from "@cognelo/plugin-web-design-coding-exercises/server";

export type ServerActivityRecord = {
  id: string;
  title: string;
  description: string;
  lifecycle: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  activityType: {
    key: string;
    name: string;
    description: string;
  };
};

export type PluginRouteContext = {
  user: CurrentUser;
  courseId: string;
  groupId?: string;
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

export type ServerActivityPlugin = {
  key: string;
  routes?: readonly PluginRouteDefinition[];
};

const serverPlugins: readonly ServerActivityPlugin[] = [
  placeholderServerPlugin,
  homeworkGraderServerPlugin,
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
