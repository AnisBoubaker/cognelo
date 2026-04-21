import { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { activatePendingAccount } from "@cognelo/core";
import { authCookie, handleRoute, json, options, readJson } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const { user, token } = await activatePendingAccount(await readJson(request), getServerEnv().JWT_SECRET);
    const response = json({ user });
    response.cookies.set(authCookie(token));
    return response;
  });
}
