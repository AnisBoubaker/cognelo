import { isIP } from "node:net";
import { clearRateLimit, consumeRateLimits } from "@cognelo/core";
import { getServerEnv } from "@cognelo/config";

export function authenticationSource(request: Request) {
  // Only enable behind an exclusive proxy which overwrites this header. Never
  // trust arbitrary X-Forwarded-For chains supplied by the caller.
  const value = process.env.AUTH_TRUST_PROXY === "true" ? request.headers.get("x-cognelo-client-ip")?.trim() : null;
  return value && isIP(value) ? value : "shared";
}

export async function limitAuthentication(request: Request, email: string, action: "login" | "activate") {
  const secret = getServerEnv().JWT_SECRET;
  await consumeRateLimits([
    { scope: "auth-source", subject: authenticationSource(request), limit: 200, windowMs: 60_000 },
    { scope: `auth-${action}`, subject: email.trim().toLowerCase(), limit: 10, windowMs: 15 * 60_000 }
  ], secret);
}

export async function authenticationSucceeded(email: string) {
  await clearRateLimit("auth-login", email.trim().toLowerCase(), getServerEnv().JWT_SECRET);
}
