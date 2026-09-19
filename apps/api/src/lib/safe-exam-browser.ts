import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@cognelo/config";
import {
  AppError,
  createSafeExamBrowserAccessToken,
  getGroupAssignedActivityAccess,
  verifySafeExamBrowserAccessToken,
  verifySafeExamBrowserLaunchToken,
  type SafeExamBrowserScope
} from "@cognelo/core";
import type { CurrentUser } from "@cognelo/contracts";

export const SAFE_EXAM_BROWSER_ACCESS_COOKIE = "cognelo_seb_access";
export const SAFE_EXAM_BROWSER_DOWNLOAD_URL = "https://safeexambrowser.org/download_en.html";

type SebSetting = string | number | boolean | { data: string };

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function settingXml(value: SebSetting) {
  if (typeof value === "boolean") return value ? "<true/>" : "<false/>";
  if (typeof value === "number") return `<integer>${value}</integer>`;
  if (typeof value === "string") return `<string>${xmlEscape(value)}</string>`;
  return `<data>${xmlEscape(value.data)}</data>`;
}

function canonicalSebJson(settings: Record<string, SebSetting>) {
  const ordered = Object.fromEntries(
    Object.entries(settings)
      .sort(([left], [right]) => left.localeCompare(right, "en", { sensitivity: "base" }))
      .map(([key, value]) => [key, typeof value === "object" ? value.data : value])
  );
  return JSON.stringify(ordered);
}

export function buildSafeExamBrowserConfiguration(scope: Omit<SafeExamBrowserScope, "userId">, launchToken: string) {
  const env = getServerEnv();
  const webOrigin = stripTrailingSlash(env.CORS_ORIGIN);
  const apiOrigin = stripTrailingSlash(env.API_PUBLIC_URL);
  const activityPath = `/courses/${encodeURIComponent(scope.courseId)}/groups/${encodeURIComponent(scope.groupId)}/activities/assigned/${encodeURIComponent(scope.activityId)}`;
  const startUrl = `${webOrigin}${activityPath}?sebLaunch=${encodeURIComponent(launchToken)}`;
  const configUrl = `${apiOrigin}/api${activityPath}/seb/config?token=${encodeURIComponent(launchToken)}`;
  const settings: Record<string, SebSetting> = {
    allowQuit: true,
    allowScreenSharing: false,
    allowSwitchToApplications: false,
    allowUserSwitching: false,
    browserWindowAllowReload: true,
    browserWindowShowURL: 0,
    browserWindowWebView: 3,
    configKeySalt: { data: createHash("sha256").update(launchToken).digest("base64") },
    enableBrowserWindowToolbar: false,
    enablePrintScreen: false,
    enableRightMouse: false,
    sebConfigPurpose: 0,
    sendBrowserExamKey: true,
    showReloadButton: true,
    showTaskBar: true,
    showTime: true,
    startURL: startUrl
  };
  const configKey = sha256(canonicalSebJson(settings));
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    ...Object.entries(settings).map(([key, value]) => `<key>${xmlEscape(key)}</key>${settingXml(value)}`),
    "</dict></plist>"
  ].join("");
  return {
    body,
    configKey,
    configUrl,
    downloadUrl: configUrl,
    launchUrl: configUrl.replace(/^https:/, "sebs:").replace(/^http:/, "seb:"),
    startUrl
  };
}

function secureHashEqual(actual: string | null | undefined, expected: string) {
  if (!actual || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  const actualBytes = Buffer.from(actual.toLowerCase(), "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function verifySafeExamBrowserProof(
  request: NextRequest,
  config: ReturnType<typeof buildSafeExamBrowserConfiguration>,
  javascriptConfigKeyHash?: string
) {
  const headerHash = request.headers.get("x-safeexambrowser-configkeyhash");
  const expectedHeaderHash = sha256(`${request.url}${config.configKey}`);
  const expectedJavascriptHash = sha256(`${config.startUrl}${config.configKey}`);
  if (!secureHashEqual(headerHash, expectedHeaderHash) && !secureHashEqual(javascriptConfigKeyHash, expectedJavascriptHash)) {
    throw new AppError(
      403,
      "SAFE_EXAM_BROWSER_PROOF_INVALID",
      "Open this assessment from its Safe Exam Browser configuration."
    );
  }
}

function scopesMatch(actual: SafeExamBrowserScope, expected: SafeExamBrowserScope) {
  return actual.userId === expected.userId &&
    actual.courseId === expected.courseId &&
    actual.groupId === expected.groupId &&
    actual.activityId === expected.activityId;
}

export async function hasSafeExamBrowserAccess(user: CurrentUser, scope: Omit<SafeExamBrowserScope, "userId">) {
  const token = (await cookies()).get(SAFE_EXAM_BROWSER_ACCESS_COOKIE)?.value;
  if (!token) return false;
  try {
    const actual = await verifySafeExamBrowserAccessToken(token, getServerEnv().JWT_SECRET);
    return scopesMatch(actual, { ...scope, userId: user.id });
  } catch {
    return false;
  }
}

export async function requireSafeExamBrowserAccess(
  request: NextRequest | Request,
  user: CurrentUser,
  courseId: string,
  groupId: string,
  activityId: string
) {
  void request;
  const access = await getGroupAssignedActivityAccess(user, courseId, groupId, activityId);
  if (!access.requiresSafeExamBrowser || access.canBypass) return access;
  if (await hasSafeExamBrowserAccess(user, { courseId, groupId, activityId })) return access;
  throw new AppError(
    403,
    "SAFE_EXAM_BROWSER_REQUIRED",
    "This summative activity must be opened in Safe Exam Browser."
  );
}

export async function createSafeExamBrowserSession(
  user: CurrentUser,
  token: string,
  request: NextRequest,
  javascriptConfigKeyHash?: string
) {
  const env = getServerEnv();
  const scope = await verifySafeExamBrowserLaunchToken(token, env.JWT_SECRET);
  if (scope.userId !== user.id) {
    throw new AppError(403, "SAFE_EXAM_BROWSER_LAUNCH_USER_MISMATCH", "Sign in with the account that launched this assessment.");
  }
  const access = await getGroupAssignedActivityAccess(user, scope.courseId, scope.groupId, scope.activityId);
  if (!access.requiresSafeExamBrowser || access.canBypass) {
    throw new AppError(409, "SAFE_EXAM_BROWSER_NOT_REQUIRED", "This activity does not require Safe Exam Browser.");
  }
  const config = buildSafeExamBrowserConfiguration(scope, token);
  verifySafeExamBrowserProof(request, config, javascriptConfigKeyHash);
  return {
    accessToken: await createSafeExamBrowserAccessToken(scope, env.JWT_SECRET),
    scope
  };
}

export function safeExamBrowserAccessCookie(token: string) {
  return {
    name: SAFE_EXAM_BROWSER_ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  };
}
