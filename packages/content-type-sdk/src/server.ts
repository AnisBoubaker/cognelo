import { fileContentServerPlugin } from "@cognelo/plugin-file-content/server";
import { githubRepoContentServerPlugin } from "@cognelo/plugin-github-repo/server";
import { textContentServerPlugin } from "@cognelo/plugin-text-content/server";
import type { CurrentUser } from "@cognelo/contracts";
import type { ContentEmbeddingSourceKind } from "./index";

export type ServerContentResourceRecord = {
  id: string;
  courseId: string;
  groupId?: string | null;
  contentTypeKey: string;
  pluginKey: string;
  title: string;
  metadata?: Record<string, unknown>;
};

export type ContentTypeRouteContext = {
  user: CurrentUser;
  courseId: string;
  groupId?: string;
  contentTypeKey: string;
  resourceId?: string;
  path: string[];
  resource?: ServerContentResourceRecord;
};

export type ContentTypeRouteHandler = (input: {
  request: Request;
  context: ContentTypeRouteContext;
  readJson: () => Promise<unknown>;
}) => Promise<unknown>;

export type ContentTypeRouteDefinition = {
  path: string;
  contentTypeKeys?: readonly string[];
  methods: Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", ContentTypeRouteHandler>>;
};

export type ContentTypeCreateResult = {
  title: string;
  metadata?: Record<string, unknown>;
  pluginResourceId?: string | null;
};

export type ContentTypeCreateHandler = (input: {
  user: CurrentUser;
  courseId: string;
  groupId?: string | null;
  contentTypeKey: string;
  payload: unknown;
}) => Promise<ContentTypeCreateResult>;

export type ContentTypeUpdateResult = {
  title?: string;
  metadata?: Record<string, unknown>;
};

export type ContentTypeUpdateHandler = (input: {
  user: CurrentUser;
  resource: ServerContentResourceRecord;
  payload: unknown;
}) => Promise<ContentTypeUpdateResult>;

export type ContentTypeDeleteHandler = (input: {
  user: CurrentUser;
  resource: ServerContentResourceRecord;
}) => Promise<void>;

export type ContentTypeOpenAction = {
  kind: "download" | "external_url" | "plugin_route" | "viewer" | "none";
  href?: string;
  routePath?: string[];
  metadata?: Record<string, unknown>;
};

export type ContentTypeOpenActionHandler = (input: {
  user: CurrentUser;
  resource: ServerContentResourceRecord;
}) => Promise<ContentTypeOpenAction>;

export type ContentEmbeddingSource =
  | { kind: "text"; text: string; sourceId: string }
  | { kind: "file"; fileRef: string; mimeType?: string; sourceId: string }
  | { kind: "external_url"; url: string; sourceId: string }
  | { kind: "none"; sourceId: string };

export type ContentTypeEmbeddingSourceHandler = (input: {
  resource: ServerContentResourceRecord;
  preferredKind?: ContentEmbeddingSourceKind;
}) => Promise<ContentEmbeddingSource>;

export type ServerContentTypePlugin = {
  key: string;
  routes?: readonly ContentTypeRouteDefinition[];
  handlers?: {
    create?: ContentTypeCreateHandler;
    update?: ContentTypeUpdateHandler;
    delete?: ContentTypeDeleteHandler;
    resolveOpenAction?: ContentTypeOpenActionHandler;
    getEmbeddingSource?: ContentTypeEmbeddingSourceHandler;
  };
};

const serverPlugins: readonly ServerContentTypePlugin[] = [githubRepoContentServerPlugin, fileContentServerPlugin, textContentServerPlugin];

function normalizePath(path: string | readonly string[]) {
  const segments: readonly string[] = typeof path === "string" ? path.split("/") : path;
  return segments.map((segment) => segment.trim()).filter(Boolean).join("/");
}

export function createServerContentTypeRegistry(registryPlugins: readonly ServerContentTypePlugin[]) {
  const pluginKeys = new Set<string>();
  for (const plugin of registryPlugins) {
    if (pluginKeys.has(plugin.key)) {
      throw new Error(`Server content type plugin already registered: ${plugin.key}`);
    }
    pluginKeys.add(plugin.key);
  }

  return {
    getServerContentTypePlugin(key: string) {
      return registryPlugins.find((plugin) => plugin.key === key);
    },
    listServerContentTypePlugins() {
      return [...registryPlugins];
    },
    listContentTypePluginRoutes() {
      return registryPlugins.flatMap((plugin) =>
        (plugin.routes ?? []).map((route) => ({
          pluginKey: plugin.key,
          path: normalizePath(route.path),
          contentTypeKeys: route.contentTypeKeys ?? []
        }))
      );
    },
    resolveContentTypePluginRoute(pluginKey: string, contentTypeKey: string, path: readonly string[]) {
      const normalizedPath = normalizePath(path);
      const plugin = registryPlugins.find((candidate) => candidate.key === pluginKey);
      if (!plugin) {
        return null;
      }

      for (const route of plugin.routes ?? []) {
        if (normalizePath(route.path) !== normalizedPath) {
          continue;
        }
        if (route.contentTypeKeys && !route.contentTypeKeys.includes(contentTypeKey)) {
          continue;
        }
        return route;
      }

      return null;
    }
  };
}

const registry = createServerContentTypeRegistry(serverPlugins);

export function getServerContentTypePlugin(key: string) {
  return registry.getServerContentTypePlugin(key);
}

export function listServerContentTypePlugins() {
  return registry.listServerContentTypePlugins();
}

export function listContentTypePluginRoutes() {
  return registry.listContentTypePluginRoutes();
}

export function resolveContentTypePluginRoute(pluginKey: string, contentTypeKey: string, path: readonly string[]) {
  return registry.resolveContentTypePluginRoute(pluginKey, contentTypeKey, path);
}
