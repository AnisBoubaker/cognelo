import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@cognelo/config";
import { validateCsrfOrigin } from "@/lib/csrf";

export function proxy(request: NextRequest) {
  const env = getServerEnv();
  if (validateCsrfOrigin(request, env.CORS_ORIGIN)) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: { code: "CSRF_ORIGIN_REJECTED", message: "The request origin is not allowed." } },
    {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": env.CORS_ORIGIN,
        "Access-Control-Allow-Credentials": "true",
        "Cache-Control": "no-store"
      }
    }
  );
}

export const config = { matcher: "/api/:path*" };
