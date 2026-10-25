import { ActivateAccountInputSchema } from "@cognelo/contracts";
import { limitAuthentication } from "@/lib/auth-rate-limit";
import { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { activatePendingAccount } from "@cognelo/core";
import { authCookie, handleRoute, json, options, readJson } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST(request: NextRequest) {
  return handleRoute(async () => {
    const input = ActivateAccountInputSchema.parse(await readJson(request, 8192));
    await limitAuthentication(request, input.email, "activate");
    const { user, token } = await activatePendingAccount(input, getServerEnv().JWT_SECRET);
    const response = json({ user });
    response.cookies.set(authCookie(token));
    return response;
  });
}
