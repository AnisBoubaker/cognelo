import { describe, expect, it } from "vitest";
import { getTestCountdownTone, shouldAutoSubmitTestAttempt } from "./test-countdown";

describe("Test countdown", () => {
  it("uses the normal tone until strictly less than one sixth of the time remains", () => {
    expect(getTestCountdownTone(120, 12)).toBe("normal");
    expect(getTestCountdownTone(119, 12)).toBe("warning");
  });

  it("uses the critical tone for the final minute", () => {
    expect(getTestCountdownTone(61, 12)).toBe("warning");
    expect(getTestCountdownTone(60, 12)).toBe("critical");
    expect(getTestCountdownTone(0, 12)).toBe("critical");
  });

  it("keeps the normal tone when there is no valid total duration", () => {
    expect(getTestCountdownTone(90, null)).toBe("normal");
    expect(getTestCountdownTone(90, 0)).toBe("normal");
  });
});

describe("Test automatic submission", () => {
  const ready = {
    attemptId: "attempt-1",
    lifecycle: "started",
    remainingSeconds: 0,
    resumeBlocked: false,
    pendingSaveCount: 0,
    busy: false,
    autoSubmittedAttemptId: null
  };

  it("submits a started attempt when its countdown reaches zero", () => {
    expect(shouldAutoSubmitTestAttempt(ready)).toBe(true);
  });

  it("waits for pending answer saves before submitting", () => {
    expect(shouldAutoSubmitTestAttempt({ ...ready, pendingSaveCount: 1 })).toBe(false);
  });

  it("does not submit twice or while another action is running", () => {
    expect(shouldAutoSubmitTestAttempt({ ...ready, autoSubmittedAttemptId: "attempt-1" })).toBe(false);
    expect(shouldAutoSubmitTestAttempt({ ...ready, busy: true })).toBe(false);
  });

  it("does not submit a completed attempt or one with time remaining", () => {
    expect(shouldAutoSubmitTestAttempt({ ...ready, lifecycle: "submitted" })).toBe(false);
    expect(shouldAutoSubmitTestAttempt({ ...ready, remainingSeconds: 1 })).toBe(false);
  });
});
