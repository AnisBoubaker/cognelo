import { NextRequest } from "next/server";
import { createContentFolder } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const { groupId: _ignoredGroupId, ...body } = asRecord(await readJson(request));
    return json(
      { contentItem: await createContentFolder(user, courseId, body as Parameters<typeof createContentFolder>[2]) },
      { status: 201 }
    );
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
}
