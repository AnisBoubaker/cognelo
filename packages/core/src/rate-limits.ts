import { createHmac } from "node:crypto";
import { prisma } from "@cognelo/db";
import { AppError } from "./errors";

export type RateLimit = { scope: string; subject: string; limit: number; windowMs: number };
export function rateLimitKey(scope: string, subject: string, secret = process.env.JWT_SECRET) {
  if (!secret) throw new AppError(503, "RATE_LIMIT_UNAVAILABLE", "Request protection is unavailable.");
  return createHmac("sha256", secret).update(JSON.stringify([scope, subject])).digest("hex");
}

/** Shared across workers/restarts; blocked attempts do not extend the fixed window. */
export async function consumeRateLimits(limits: RateLimit[], secret = process.env.JWT_SECRET, now = new Date()) {
  const keyed = limits.map((limit) => ({ ...limit, key: rateLimitKey(limit.scope, limit.subject, secret) })).sort((a, b) => a.key.localeCompare(b.key));
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "expiresAt" <= ${now}`;
    for (const limit of keyed) {
      const expiresAt = new Date(now.getTime() + limit.windowMs);
      const [bucket] = await tx.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
        INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt") VALUES (${limit.key}, 1, ${expiresAt})
        ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
        RETURNING "count", "expiresAt"`;
      if (bucket.count > limit.limit) throw new AppError(429, "RATE_LIMIT_EXCEEDED", "Too many requests. Try again later.", { retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000)) });
    }
  });
}

export async function clearRateLimit(scope: string, subject: string, secret = process.env.JWT_SECRET) {
  const key = rateLimitKey(scope, subject, secret);
  await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${key}`;
}
