import { NextRequest } from "next/server";
import { resolveContentTypePluginRoute } from "@cognelo/content-type-sdk/server";
import { AppError, assertCanManageCourse, getContentResourceForPluginRoute } from "@cognelo/core";
import { json, requireUser } from "./http";

type DispatchParams = {
  courseId: string;
  groupId?: string;
  resourceId: string;
  pluginPath: string[];
};

export async function dispatchContentTypePluginRoute(request: NextRequest, params: DispatchParams) {
  const user = await requireUser();
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    await assertCanManageCourse(user, params.courseId);
  }
  const resource = await getContentResourceForPluginRoute(user, params.courseId, params.resourceId, {
    groupId: params.groupId
  });
  const route = resolveContentTypePluginRoute(resource.pluginKey, resource.contentTypeKey, params.pluginPath);

  if (!route) {
    throw new AppError(404, "PLUGIN_ROUTE_NOT_FOUND", "The requested plugin route does not exist for this content resource.");
  }

  const handler = route.methods[request.method as keyof typeof route.methods];
  if (!handler) {
    throw new AppError(405, "METHOD_NOT_ALLOWED", "This plugin route does not support that HTTP method.");
  }

  const payload = await handler({
    request,
    context: {
      user,
      courseId: params.courseId,
      groupId: params.groupId,
      contentTypeKey: resource.contentTypeKey,
      resourceId: resource.id,
      path: params.pluginPath,
      resource: {
        id: resource.id,
        courseId: resource.courseId,
        groupId: resource.groupId,
        contentTypeKey: resource.contentTypeKey,
        pluginKey: resource.pluginKey,
        title: resource.title,
        metadata: (resource.metadata as Record<string, unknown> | null) ?? undefined
      }
    },
    readJson: async () => {
      try {
        return await request.json();
      } catch {
        return {};
      }
    }
  });

  if (payload instanceof Response) {
    return payload;
  }

  return json(payload);
}
