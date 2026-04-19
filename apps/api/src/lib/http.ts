import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getServerEnv } from "@cognelo/config";
import { AppError, verifyAuthToken } from "@cognelo/core";

export const AUTH_COOKIE = "cognelo_session";

export async function requireUser() {
  const env = getServerEnv();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return verifyAuthToken(token, env.JWT_SECRET);
}

function corsHeaders(init?: ResponseInit) {
  const env = getServerEnv();
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Cache-Control": "no-store",
    ...(init?.headers ?? {})
  };
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: corsHeaders(init)
  });
}

export function options() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function readJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function handleRoute(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { error: { code: "VALIDATION_ERROR", message: "Request validation failed.", details: error.flatten() } },
        { status: 400 }
      );
    }
    if (error instanceof AppError) {
      return json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
    }
    console.error(error);
    return json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, { status: 500 });
  }
}

export function authCookie(token: string) {
  return {
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  };
}
