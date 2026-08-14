import type { NextRequest } from "next/server";

export const AUTH_COOKIE = "cognelo_session";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function validateCsrfOrigin(request: Pick<NextRequest, "method" | "headers" | "cookies">, allowedOrigin: string) {
  if (SAFE_METHODS.has(request.method.toUpperCase()) || !request.cookies.get(AUTH_COOKIE)?.value) {
    return true;
  }
  const origin = request.headers.get("origin");
  return origin === new URL(allowedOrigin).origin;
}
