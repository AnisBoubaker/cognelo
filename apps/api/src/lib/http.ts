import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getServerEnv } from "@cognelo/config";
import { AppError, readBoundedJson, refreshAuthSession, verifyAuthToken } from "@cognelo/core";
import "@cognelo/plugin-registry/server";
export { AUTH_COOKIE, validateCsrfOrigin } from "./csrf";
import { AUTH_COOKIE } from "./csrf";


export async function requireUser(options: { allowPasswordChangeRequired?: boolean; allowEmailVerificationRequired?: boolean } = {}) {
  const env = getServerEnv();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const user = await verifyAuthToken(token, env.JWT_SECRET);
  assertAccountReady(user, options);
  return user;
}

export async function refreshUserSession(options: { allowPasswordChangeRequired?: boolean; allowEmailVerificationRequired?: boolean } = {}) {
  const env = getServerEnv();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const session = await refreshAuthSession(token, env.JWT_SECRET);
  assertAccountReady(session.user, options);
  return session;
}

function assertAccountReady(
  user: Awaited<ReturnType<typeof verifyAuthToken>>,
  options: { allowPasswordChangeRequired?: boolean; allowEmailVerificationRequired?: boolean }
) {
  if (user.mustChangePassword && !options.allowPasswordChangeRequired) {
    throw new AppError(403, "PASSWORD_CHANGE_REQUIRED", "You must change your temporary password before continuing.");
  }
  if (user.emailVerified === false && !options.allowEmailVerificationRequired) {
    throw new AppError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email address before continuing.");
  }
}

function corsHeaders(init?: ResponseInit) {
  const env = getServerEnv();
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-SafeExamBrowser-ConfigKeyHash",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
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

/** A single authenticated mutation with measured progress and a terminal result.
 * Disconnecting the reader must not interrupt persistence halfway through a batch. */
export function progressJson<TProgress>(run: (report: (progress: TProgress) => void) => Promise<unknown>) {
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
          catch { closed = true; }
        }
      };
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 15_000);
      try {
        const response = await handleRoute(async () => json(await run((progress) => send({ type: "progress", progress }))));
        const body = await response.json();
        send(response.ok ? { type: "result", result: body } : { type: "error", error: body.error, status: response.status });
      } finally {
        clearInterval(heartbeat);
        if (!closed) { closed = true; controller.close(); }
      }
    },
    cancel() { closed = true; }
  });
  return new Response(stream, { headers: corsHeaders({ headers: {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no"
  } }) });
}

export async function readJson(request: NextRequest, maximum?: number) {
  return readBoundedJson(request, maximum);
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
      return json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status, ...(error.status === 429 ? { headers: { "Retry-After": String((error.details as { retryAfterSeconds?: number })?.retryAfterSeconds ?? 60) } } : {}) });
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
