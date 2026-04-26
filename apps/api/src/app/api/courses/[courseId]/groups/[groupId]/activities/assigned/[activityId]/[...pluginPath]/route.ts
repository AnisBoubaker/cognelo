import { NextRequest } from "next/server";
import { resolvePluginRoute } from "@cognelo/activity-sdk/server";
import { AppError, getGroupAssignedActivity } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; activityId: string; pluginPath: string[] }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

async function dispatchPluginRoute(request: NextRequest, params: Awaited<Params["params"]>) {
  const user = await requireUser();
  const { courseId, groupId, activityId, pluginPath } = params;
  const activity = await getGroupAssignedActivity(user, courseId, groupId, activityId);
  const route = resolvePluginRoute(activity.activityType.key, pluginPath);

  if (!route) {
    throw new AppError(404, "PLUGIN_ROUTE_NOT_FOUND", "The requested plugin route does not exist for this activity.");
  }

  const handler = route.methods[request.method as keyof typeof route.methods];
  if (!handler) {
    throw new AppError(405, "METHOD_NOT_ALLOWED", "This plugin route does not support that HTTP method.");
  }

  const payload = await handler({
    request,
    context: {
      user,
      courseId,
      groupId,
      activityId,
      path: pluginPath,
      activity: {
        id: activity.id,
        bankActivityId: activity.bankActivityId,
        activityVersionId: activity.activityVersionId,
        title: activity.title,
        description: activity.description,
        lifecycle: activity.lifecycle,
        config: (activity.config as Record<string, unknown> | null) ?? undefined,
        metadata: (activity.metadata as Record<string, unknown> | null) ?? undefined,
        activityType: {
          key: activity.activityType.key,
          name: activity.activityType.name,
          description: activity.activityType.description
        }
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

  return json(payload);
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatchPluginRoute(request, await params));
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatchPluginRoute(request, await params));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatchPluginRoute(request, await params));
}

export async function PUT(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatchPluginRoute(request, await params));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatchPluginRoute(request, await params));
}
