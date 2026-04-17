import { NextRequest } from "next/server";
import { LoginInputSchema } from "@cognara/contracts";
import { getServerEnv } from "@cognara/config";
import { loginWithPassword } from "@cognara/core";
import { authCookie, handleRoute, json, options, readJson } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const input = LoginInputSchema.parse(await readJson(request));
    const { user, token } = await loginWithPassword(input.email, input.password, getServerEnv().JWT_SECRET);
    const response = json({ user });
    response.cookies.set(authCookie(token));
    return response;
  });
}
