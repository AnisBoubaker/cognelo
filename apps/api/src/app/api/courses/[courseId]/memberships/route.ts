import { NextRequest } from "next/server";
import { addCourseMembership } from "@cognara/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    return json({ membership: await addCourseMembership(user, courseId, await readJson(request)) }, { status: 201 });
  });
}
