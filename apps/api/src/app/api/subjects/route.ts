import { NextRequest } from "next/server";
import { createSubject, listSubjects } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ subjects: await listSubjects(user) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ subject: await createSubject(user, await readJson(request)) }, { status: 201 });
  });
}
