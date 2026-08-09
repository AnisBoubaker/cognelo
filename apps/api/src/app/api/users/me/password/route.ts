import type { NextRequest } from "next/server";
import { changeMyPassword } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function PUT(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser();
    return json(await changeMyPassword(user, await readJson(request)));
  });
}
