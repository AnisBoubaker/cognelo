import { describe, expect, it } from "vitest";
import { fromZonedDateTimeInput, toZonedDateTimeInput } from "@cognelo/activity-ui";
import { homeworkSubmissionPolicySchema, homeworkSubmissionWindow, homeworkSubmissionTiming, readHomeworkSubmissionPolicy, readHomeworkSubmissionTiming, formatHomeworkLateness } from "./submission-policy";
import { acceptHomeworkSubmissionTiming } from "./submission-window";
const deadline = "2026-11-05T14:30:00.000Z", instant = Date.parse(deadline);
describe("homework hand-in deadlines", () => {
  it("leaves existing homework unlimited and uses explicit-zone UTC instants", () => {
    expect(homeworkSubmissionWindow(readHomeworkSubmissionPolicy({}), instant)).toEqual({ isLate: false, closed: false, closesAt: null });
    expect(fromZonedDateTimeInput("2026-11-05T09:30", "America/Toronto")).toBe(deadline);
    expect(toZonedDateTimeInput(deadline, "America/Toronto")).toBe("2026-11-05T09:30");
    expect(homeworkSubmissionPolicySchema.parse({ deadline: "2026-11-05T09:30:00-05:00" }).deadline).toBe(deadline);
  });
  it("closes at the deadline when late work is disallowed", () => {
    const submissionPolicy = homeworkSubmissionPolicySchema.parse({ deadline });
    expect(homeworkSubmissionWindow(submissionPolicy, instant - 1).closed).toBe(false);
    expect(() => acceptHomeworkSubmissionTiming({ submissionPolicy }, instant)).toThrow("deadline");
    expect(() => acceptHomeworkSubmissionTiming({ submissionPolicy }, instant + 1)).toThrow("deadline");
  });
  it("accepts unlimited late work and closes bounded lateness at the exact cutoff", () => {
    const unlimited = homeworkSubmissionPolicySchema.parse({ deadline, allowLate: true });
    expect(homeworkSubmissionWindow(unlimited, instant + 30 * 86400_000)).toEqual({ isLate: true, closed: false, closesAt: null });
    const limited = { ...unlimited, lateLimitMinutes: 60 };
    expect(homeworkSubmissionWindow(limited, instant + 3599_999).closed).toBe(false);
    expect(() => acceptHomeworkSubmissionTiming({ submissionPolicy: limited }, instant + 3600_000)).toThrow("deadline");
  });
  it("records exact hand-in lateness independently of later policy changes", () => {
    const policy = homeworkSubmissionPolicySchema.parse({ deadline, allowLate: true });
    const timing = homeworkSubmissionTiming(policy, instant + (1440 + 120 + 15) * 60_000 + 1234);
    expect(timing).toMatchObject({ isLate: true, lateByMs: 94_501_234, deadline });
    expect(readHomeworkSubmissionTiming({ submissionTiming: timing })).toEqual(timing);
    expect(formatHomeworkLateness(timing.lateByMs, "en")).toBe("1 day, 2 hours, 15 minutes");
    expect(formatHomeworkLateness(timing.lateByMs, "fr")).toContain("15 minutes");
    expect(formatHomeworkLateness(12_345, "en")).toBe("12 seconds");
    expect(homeworkSubmissionTiming(policy, instant - 1)).toMatchObject({ isLate: false, lateByMs: 0 });
    expect(readHomeworkSubmissionTiming({})).toBeNull();
  });
  it.each([
    { allowLate: true }, { deadline, lateLimitMinutes: 5 }, { deadline, allowLate: true, lateLimitMinutes: 0 },
    { deadline, allowLate: true, lateLimitMinutes: -1 }, { deadline, allowLate: true, lateLimitMinutes: 1.5 },
    { deadline: "2026-11-05T09:30" }, { deadline: "not a date" }, { deadline, allowLate: true, lateLimitMinutes: 3650 * 1440 + 1 }
  ])("rejects invalid or inconsistent policy %j", value => { expect(homeworkSubmissionPolicySchema.safeParse(value).success).toBe(false); });
});
