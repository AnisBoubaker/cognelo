import { describe, expect, it } from "vitest";
import { SubmissionStagePoliciesSchema, defaultSubmissionStagePolicy, mergeSubmissionStagePolicies, submissionStageWindow } from "./submission-stages";
const instant = Date.parse("2030-01-01T12:00:00Z"), date = (minutes: number) => new Date(instant + minutes * 60_000).toISOString();
describe("submission-stage scheduling", () => {
  it("stores explicit activation independently of dates and preserves it through inheritance", () => {
    expect(SubmissionStagePoliciesSchema.parse({ files: { enabled: false }, questions: { enabled: true } })).toEqual({ files: { enabled: false }, questions: { enabled: true } });
    expect(SubmissionStagePoliciesSchema.safeParse({ files: { enabled: "true" } }).success).toBe(false);
    expect(SubmissionStagePoliciesSchema.safeParse({ files: { enabled: null } }).success).toBe(false);
    expect(mergeSubmissionStagePolicies({ files: { enabled: false, deadline: date(5) } }, { files: { enabled: true } })).toEqual({ files: { enabled: true, deadline: date(5) } });
    expect(submissionStageWindow({ ...defaultSubmissionStagePolicy, enabled: false, deadline: date(-1) }, null, null, instant).closed).toBe(true);
  });
  for (const stage of [null, -10, 10, 30]) for (const overall of [null, -10, 10, 30]) {
    it(`resolves stage ${stage} and overall ${overall} independently, including exact boundaries`, () => {
      const policy = { ...defaultSubmissionStagePolicy, deadline: stage === null ? null : date(stage) };
      const end = [stage, overall].filter((v): v is number => v !== null), cutoff = end.length ? Math.min(...end) : null;
      const result = submissionStageWindow(policy, overall === null ? null : date(overall), null, instant);
      expect(result.deadline).toBe(cutoff === null ? null : date(cutoff)); expect(result.closesAt).toBe(result.deadline);
      expect(result.closed).toBe(cutoff !== null && cutoff <= 0);
      if (cutoff !== null) { expect(submissionStageWindow(policy, overall === null ? null : date(overall), null, Date.parse(date(cutoff))).closed).toBe(true); }
    });
  }
  for (const allowLate of [false, true]) for (const limit of [null, 5, 30]) for (const overall of [null, 10, 60]) for (const duration of [null, 15, 90]) {
    it(`caps late=${allowLate}/${limit}, overall=${overall}, duration=${duration}`, () => {
      const policy = { deadline: date(5), allowLate, lateLimitMinutes: limit, timeLimitMinutes: duration };
      const due = Math.min(5, overall ?? Infinity), late = !allowLate ? due : limit === null ? Infinity : due + limit;
      const cutoff = Math.min(late, overall ?? Infinity, duration ?? Infinity);
      const result = submissionStageWindow(policy, overall === null ? null : date(overall), date(0), instant + 6 * 60_000);
      expect(result.closesAt).toBe(Number.isFinite(cutoff) ? date(cutoff) : null); expect(result.lateByMs).toBe(60_000); expect(result.isLate).toBe(true);
    });
  }
  it("does not start a duration during a queued stage", () => {
    expect(submissionStageWindow({ ...defaultSubmissionStagePolicy, timeLimitMinutes: 5 }, null, null, instant).closesAt).toBeNull();
    expect(submissionStageWindow({ ...defaultSubmissionStagePolicy, timeLimitMinutes: 5 }, null, date(0), instant).closesAt).toBe(date(5));
  });
  it("merges only explicit stage fields and permits null to clear inheritance", () => {
    expect(mergeSubmissionStagePolicies({ files: { deadline: date(5), allowLate: true }, questions: { timeLimitMinutes: 20 } }, { files: { deadline: null } }, { questions: { deadline: date(30) } })).toEqual({ files: { deadline: null, allowLate: true }, questions: { timeLimitMinutes: 20, deadline: date(30) } });
  });
  it.each([{ files: { timeLimitMinutes: 0 } }, { questions: { deadline: "2030-01-01T12:00" } }, { files: { lateLimitMinutes: -1 } }, { "bad key": {} }, { files: { unsupported: true } }])("rejects malformed policy %j", value => expect(SubmissionStagePoliciesSchema.safeParse(value).success).toBe(false));
});
