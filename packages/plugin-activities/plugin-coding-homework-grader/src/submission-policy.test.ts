import { describe, expect, it } from "vitest";
import { fromZonedDateTimeInput, toZonedDateTimeInput } from "@cognelo/activity-ui";
import { homeworkSubmissionPolicySchema, homeworkSubmissionWindow, homeworkSubmissionTiming, readHomeworkSubmissionPolicy, readHomeworkSubmissionTiming, formatHomeworkLateness } from "./submission-policy";
import { acceptHomeworkSubmissionTiming, automaticHomeworkTiming, assertAutomaticHomeworkDraft } from "./submission-window";
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


describe("automatic deadline recovery", () => {
  it("uses the cutoff rather than the later recovery time for lateness", () => {
    const submissionPolicy = homeworkSubmissionPolicySchema.parse({ deadline });
    expect(automaticHomeworkTiming({ submissionPolicy }, { cutoff: deadline, triggeredBy: "staff" }, instant + 86400_000)).toEqual({ deadline, submittedAt: deadline, isLate: false, lateByMs: 0 });
    const grace = { ...submissionPolicy, allowLate: true, lateLimitMinutes: 60 };
    const cutoff = new Date(instant + 3600_000).toISOString();
    expect(automaticHomeworkTiming({ submissionPolicy: grace }, { cutoff, triggeredBy: "staff" }, instant + 86400_000)).toMatchObject({ submittedAt: cutoff, isLate: true, lateByMs: 3600_000 });
  });
  it("does not recover before a finite cutoff or for unlimited late work", () => {
    const automatic = { cutoff: deadline, triggeredBy: "staff" };
    expect(() => automaticHomeworkTiming({ submissionPolicy: { deadline } }, automatic, instant - 1)).toThrow();
    expect(() => automaticHomeworkTiming({ submissionPolicy: { deadline, allowLate: true } }, automatic, instant + 86400_000)).toThrow();
    expect(() => automaticHomeworkTiming({}, automatic, instant + 86400_000)).toThrow();
    expect(() => automaticHomeworkTiming({ submissionPolicy: { deadline: new Date(instant + 60_000).toISOString() } }, automatic, instant + 86400_000)).toThrow();
  });
  it("preserves teacher cancellation and rejects empty or post-cutoff drafts", () => {
    const automatic = { cutoff: deadline, triggeredBy: "staff" };
    const draft = { files: [{ path: "main.c" }], updatedAt: new Date(instant - 1) };
    expect(() => assertAutomaticHomeworkDraft(draft, null, automatic)).not.toThrow();
    expect(() => assertAutomaticHomeworkDraft({ ...draft, files: [] }, null, automatic)).toThrow();
    expect(() => assertAutomaticHomeworkDraft({ ...draft, updatedAt: new Date(instant + 1) }, null, automatic)).toThrow();
    expect(() => assertAutomaticHomeworkDraft(draft, { status: "cancelled", metadata: { cancellation: { cancelledAt: new Date(instant + 1).toISOString() } }, updatedAt: new Date(instant + 1) }, automatic)).toThrow(/cancelled/);
    expect(() => assertAutomaticHomeworkDraft(draft, { status: "cancelled", metadata: { cancellation: { cancelledAt: new Date(instant - 1).toISOString() } }, updatedAt: new Date(instant - 1) }, automatic)).not.toThrow();
  });
});
