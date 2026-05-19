import { NextRequest } from "next/server";
import { setGradebookItemRelease } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; gradebookItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, gradebookItemId } = await params;
    const body = await readJson(request);
    const released = Boolean((body as { released?: unknown }).released);
    return json({ gradebookItem: await setGradebookItemRelease(user, courseId, gradebookItemId, { released }) });
  });
}
