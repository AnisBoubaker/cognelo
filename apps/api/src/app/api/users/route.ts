import { createUser, listRoles, listUsers } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import type { NextRequest } from "next/server";

export function OPTIONS() { return options(); }

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    const filters = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listUsers(user, filters);
    return json({ ...result, roles: await listRoles(user) });
  });
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    return json({ user: await createUser(user, await readJson(request)) }, { status: 201 });
  });
}
