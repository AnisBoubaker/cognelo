import { describe, expect, it, vi } from "vitest";
import { readSafeExamBrowserProof, type SafeExamBrowserWindow } from "./safe-exam-browser";

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
