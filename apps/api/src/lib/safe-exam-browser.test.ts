import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildSafeExamBrowserConfiguration, verifySafeExamBrowserProof } from "./safe-exam-browser";

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "safe-exam-browser-test-secret-that-is-long-enough";
  process.env.CORS_ORIGIN = "https://learn.example.test";
  process.env.API_PUBLIC_URL = "https://learn.example.test";
});

describe("Safe Exam Browser configuration", () => {
  const scope = { courseId: "course-1", groupId: "group-1", activityId: "activity-1" };
  const launchToken = "signed.launch.token";

  it("builds an activity-specific SEB launch and downloadable plist", () => {
    const config = buildSafeExamBrowserConfiguration(scope, launchToken);
    expect(config.launchUrl).toBe(
      "sebs://learn.example.test/api/courses/course-1/groups/group-1/activities/assigned/activity-1/seb/config?token=signed.launch.token"
    );
    expect(config.startUrl).toBe(
      "https://learn.example.test/courses/course-1/groups/group-1/activities/assigned/activity-1?sebLaunch=signed.launch.token"
    );
    expect(config.body).toContain("<key>sendBrowserExamKey</key><true/>");
    expect(config.body).toContain("<key>browserWindowWebView</key><integer>3</integer>");
    expect(config.configKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts the URL-bound Config Key proof exposed by the SEB JavaScript API", () => {
    const config = buildSafeExamBrowserConfiguration(scope, launchToken);
    const hash = createHash("sha256").update(`${config.startUrl}${config.configKey}`).digest("hex");
    const request = new NextRequest(
      "https://learn.example.test/api/courses/course-1/groups/group-1/activities/assigned/activity-1/seb/activate",
      { method: "POST" }
    );
    expect(() => verifySafeExamBrowserProof(request, config, hash)).not.toThrow();
  });

  it("rejects a proof that is not bound to the generated configuration", () => {
    const config = buildSafeExamBrowserConfiguration(scope, launchToken);
    const request = new NextRequest(
      "https://learn.example.test/api/courses/course-1/groups/group-1/activities/assigned/activity-1/seb/activate",
      { method: "POST" }
    );
    expect(() => verifySafeExamBrowserProof(request, config, "0".repeat(64))).toThrowError(
      expect.objectContaining({ code: "SAFE_EXAM_BROWSER_PROOF_INVALID" })
    );
  });
});
