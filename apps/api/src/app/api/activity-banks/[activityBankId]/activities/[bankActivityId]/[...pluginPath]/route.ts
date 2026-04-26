import { NextRequest } from "next/server";
import { resolvePluginRoute } from "@cognelo/activity-sdk/server";
import { AppError, getActivityBank } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ activityBankId: string; bankActivityId: string; pluginPath: string[] }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

async function dispatchPluginRoute(request: NextRequest, params: Awaited<Params["params"]>) {
  const user = await requireUser();
  const { activityBankId, bankActivityId, pluginPath } = params;
  const bank = await getActivityBank(user, activityBankId);
  const activity = bank.activities.find((candidate) => candidate.id === bankActivityId);

  if (!activity) {
    throw new AppError(404, "BANK_ACTIVITY_NOT_FOUND", "The requested activity was not found in this activity bank.");
  }

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
      activityBankId,
      activityId: activity.id,
      path: pluginPath,
      activity: {
        id: activity.id,
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
