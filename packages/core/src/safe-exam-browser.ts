import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { AppError } from "./errors";

const encoder = new TextEncoder();
const TOKEN_ISSUER = "cognelo";
const LAUNCH_AUDIENCE = "cognelo-safe-exam-browser-launch";
const ACCESS_AUDIENCE = "cognelo-safe-exam-browser-access";

export type SafeExamBrowserScope = {
  userId: string;
  courseId: string;
  groupId: string;
  activityId: string;
};

function secretBytes(secret: string) {
  return encoder.encode(secret);
}

async function signScopedToken(scope: SafeExamBrowserScope, secret: string, audience: string, lifetime: string) {
  return new SignJWT({
    courseId: scope.courseId,
    groupId: scope.groupId,
    activityId: scope.activityId
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(audience)
    .setSubject(scope.userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(lifetime)
    .sign(secretBytes(secret));
}

async function verifyScopedToken(token: string, secret: string, audience: string, errorCode: string) {
  try {
    const { payload } = await jwtVerify(token, secretBytes(secret), {
      issuer: TOKEN_ISSUER,
      audience
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.courseId !== "string" ||
      typeof payload.groupId !== "string" ||
      typeof payload.activityId !== "string"
    ) {
      throw new Error("Incomplete Safe Exam Browser token.");
    }
    return {
      userId: payload.sub,
      courseId: payload.courseId,
      groupId: payload.groupId,
      activityId: payload.activityId
    } satisfies SafeExamBrowserScope;
  } catch {
    throw new AppError(403, errorCode, "The Safe Exam Browser authorization is invalid or has expired.");
  }
}

export function createSafeExamBrowserLaunchToken(scope: SafeExamBrowserScope, secret: string) {
  return signScopedToken(scope, secret, LAUNCH_AUDIENCE, "10m");
}

export function verifySafeExamBrowserLaunchToken(token: string, secret: string) {
  return verifyScopedToken(token, secret, LAUNCH_AUDIENCE, "SAFE_EXAM_BROWSER_LAUNCH_INVALID");
}

export function createSafeExamBrowserAccessToken(scope: SafeExamBrowserScope, secret: string) {
  return signScopedToken(scope, secret, ACCESS_AUDIENCE, "12h");
}

export function verifySafeExamBrowserAccessToken(token: string, secret: string) {
  return verifyScopedToken(token, secret, ACCESS_AUDIENCE, "SAFE_EXAM_BROWSER_ACCESS_INVALID");
}
