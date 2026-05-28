import { NextRequest } from "next/server";
import { dispatchContentTypePluginRoute } from "@/lib/content-type-routes";
import { handleRoute, options } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string; resourceId: string; pluginPath: string[] }> };

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return options();
}

async function dispatch(request: NextRequest, params: Awaited<Params["params"]>) {
  return dispatchContentTypePluginRoute(request, params);
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatch(request, await params));
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatch(request, await params));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatch(request, await params));
}

export async function PUT(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatch(request, await params));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return handleRoute(async () => dispatch(request, await params));
}
