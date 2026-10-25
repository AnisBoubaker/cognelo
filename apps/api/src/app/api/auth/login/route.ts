import { limitAuthentication, authenticationSucceeded } from "@/lib/auth-rate-limit";
import { NextRequest } from "next/server";
import { LoginInputSchema } from "@cognelo/contracts";
import { getServerEnv } from "@cognelo/config";
import { loginWithPassword } from "@cognelo/core";
import { authCookie, handleRoute, json, options, readJson } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const input = LoginInputSchema.parse(await readJson(request, 8192));
    await limitAuthentication(request, input.email, "login");
    const { user, token } = await loginWithPassword(input.email, input.password, getServerEnv().JWT_SECRET);
    await authenticationSucceeded(input.email);
    const response = json({ user });
    response.cookies.set(authCookie(token));
    return response;
  });
}
