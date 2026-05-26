import { NextRequest } from "next/server";
import { createMaterialContentItem } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string; groupId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, groupId } = await params;
    const body = asRecord(await readJson(request));
    return json(
      { contentItem: await createMaterialContentItem(user, courseId, { ...body, groupId } as Parameters<typeof createMaterialContentItem>[2]) },
      { status: 201 }
    );
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
}
