import { describe, expect, it } from "vitest";
import {
  createSafeExamBrowserAccessToken,
  createSafeExamBrowserLaunchToken,
  verifySafeExamBrowserAccessToken,
  verifySafeExamBrowserLaunchToken
} from "./safe-exam-browser";

const secret = "safe-exam-browser-test-secret-that-is-long-enough";
const scope = {
  userId: "student-1",
  courseId: "course-1",
  groupId: "group-1",
  activityId: "activity-1"
};

describe("Safe Exam Browser authorization tokens", () => {
  it("round-trips short-lived launch scope", async () => {
    const token = await createSafeExamBrowserLaunchToken(scope, secret);
    await expect(verifySafeExamBrowserLaunchToken(token, secret)).resolves.toEqual(scope);
  });

  it("does not accept a launch token as an access session", async () => {
    const token = await createSafeExamBrowserLaunchToken(scope, secret);
    await expect(verifySafeExamBrowserAccessToken(token, secret)).rejects.toMatchObject({
      status: 403,
      code: "SAFE_EXAM_BROWSER_ACCESS_INVALID"
    });
  });

  it("round-trips an assignment-scoped access session", async () => {
    const token = await createSafeExamBrowserAccessToken(scope, secret);
    await expect(verifySafeExamBrowserAccessToken(token, secret)).resolves.toEqual(scope);
  });
});
