import { NextRequest } from "next/server";
import { listContentItems } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    const visibleOnly = request.nextUrl.searchParams.get("visibleOnly") === "true";
    return json({ contentItems: await listContentItems(user, courseId, { groupId, visibleOnly }) });
  });
}
