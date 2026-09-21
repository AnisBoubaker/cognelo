import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assignmentRequiresSafeExamBrowser,
  readSafeExamBrowserProof,
  type SafeExamBrowserWindow
} from "./safe-exam-browser";

const groupPageSource = readFileSync("apps/web/src/app/courses/[courseId]/groups/[groupId]/page.tsx", "utf8");
const assignedActivityPageSource = readFileSync(
  "apps/web/src/app/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/page.tsx",
  "utf8"
);

describe("Safe Exam Browser assignment metadata", () => {
  it("recognizes only assignments that explicitly require Safe Exam Browser", () => {
    expect(assignmentRequiresSafeExamBrowser({ requireSafeExamBrowser: true })).toBe(true);
    expect(assignmentRequiresSafeExamBrowser({ requireSafeExamBrowser: false })).toBe(false);
    expect(assignmentRequiresSafeExamBrowser({})).toBe(false);
    expect(assignmentRequiresSafeExamBrowser(null)).toBe(false);
  });

  it("does not probe protected submission history from the ordinary course overview", () => {
    expect(groupPageSource).toContain(
      ".filter((assignment) => !assignmentRequiresSafeExamBrowser(assignment.metadata))"
    );
  });

  it("closes the launch dialog before handing the configuration to Safe Exam Browser", () => {
    const handlerStart = assignedActivityPageSource.indexOf("function openActivityInSafeExamBrowser()");
    const closeGate = assignedActivityPageSource.indexOf(
      "flushSync(() => setIsSafeExamBrowserGateOpen(false));",
      handlerStart
    );
    const rememberDismissal = assignedActivityPageSource.indexOf(
      "safeExamBrowserLaunchDismissedRef.current = true;",
      handlerStart
    );
    const launchBrowser = assignedActivityPageSource.indexOf(
      "window.location.href = safeExamBrowserLaunch.launchUrl;",
      handlerStart
    );

    expect(handlerStart).toBeGreaterThan(-1);
    expect(rememberDismissal).toBeGreaterThan(handlerStart);
    expect(closeGate).toBeGreaterThan(rememberDismissal);
    expect(launchBrowser).toBeGreaterThan(closeGate);
    expect(assignedActivityPageSource).toContain("onClick={openActivityInSafeExamBrowser}");
    expect(assignedActivityPageSource).toContain("if (safeExamBrowserLaunchDismissedRef.current)");
  });
});

describe("Safe Exam Browser JavaScript proof", () => {
  it("uses keys already injected by current SEB clients without refreshing them", async () => {
    const updateKeys = vi.fn();
    const browserWindow = {
      SafeExamBrowser: {
        version: "SEB_macOS_3.7.1",
        security: { configKey: "a".repeat(64), updateKeys }
      },
      setTimeout: vi.fn()
    } as unknown as SafeExamBrowserWindow;

    await expect(readSafeExamBrowserProof(browserWindow)).resolves.toEqual({
      configKeyHash: "a".repeat(64),
      version: "SEB_macOS_3.7.1"
    });
    expect(updateKeys).not.toHaveBeenCalled();
  });

  it("refreshes keys for legacy SEB clients without relying on a named callback", async () => {
    const security: NonNullable<NonNullable<SafeExamBrowserWindow["SafeExamBrowser"]>["security"]> = {};
    security.updateKeys = vi.fn((callback) => {
      security.configKey = "b".repeat(64);
      callback();
    });
    const browserWindow = {
      SafeExamBrowser: { version: "SEB_macOS_3.0", security },
      setTimeout: vi.fn()
    } as unknown as SafeExamBrowserWindow;

    await expect(readSafeExamBrowserProof(browserWindow)).resolves.toEqual({
      configKeyHash: "b".repeat(64),
      version: "SEB_macOS_3.0"
    });
    expect(security.updateKeys).toHaveBeenCalledOnce();
  });
});
