import { describe, expect, it } from "vitest";
import { applyAssignmentExceptions, applyGradebookExceptions, exceptionsForParticipant, resolveAssignmentExceptions } from "./activity-assignment-exceptions";

const team = (priority: number, settings: unknown) => ({ groupActivityId: "assignment", teamId: `team-${priority}`, participantId: null, priority, settings });
const student = (settings: unknown) => ({ ...team(5, settings), teamId: null, participantId: "student" });

describe("activity assignment exception precedence", () => {
  it("resolves each field independently with highest-priority team first and student last", () => {
    const rows = [
      team(1, { overrideFields: ["timeLimit", "availableUntil"], timeLimitMinutes: 80, availableUntil: "2026-12-02T12:00:00.000Z" }),
      student({ overrideFields: ["timeLimit"], timeLimitMinutes: 120, availableUntil: null }),
      team(0, { overrideFields: ["timeLimit"], timeLimitMinutes: 60 })
    ];
    expect(resolveAssignmentExceptions(rows)).toEqual({ timeLimitMinutes: 120, availableUntil: "2026-12-02T12:00:00.000Z" });
    expect(resolveAssignmentExceptions(rows.filter((row) => !row.participantId)).timeLimitMinutes).toBe(60);
    expect(rows[0]!.priority).toBe(1);
  });
  it("keeps explicit null and false overrides while ignoring unchecked values", () => {
    expect(resolveAssignmentExceptions([
      team(0, { overrideFields: ["timeLimit", "visibility", "gradeChallenges"], timeLimitMinutes: 60, contentPlacement: { isVisible: true }, gradeChallengesEnabled: true }),
      student({ overrideFields: ["timeLimit", "visibility", "gradeChallenges", "availableFrom"], timeLimitMinutes: null, contentPlacement: { isVisible: false }, gradeChallengesEnabled: false, availableFrom: null, requireSafeExamBrowser: true })
    ])).toEqual({ timeLimitMinutes: null, isVisible: false, gradeChallengesEnabled: false, availableFrom: null });
  });
  it("supports every section override including grouped grading and attempt fields", () => {
    const overrides = resolveAssignmentExceptions([student({
      overrideFields: ["availableFrom", "availableUntil", "timeLimit", "visibility", "requireSafeExamBrowser", "gradeChallenges", "pointsPossible", "grading", "attempts", "gradeStrategy"],
      availableFrom: "2026-01-01T00:00:00.000Z", availableUntil: null, timeLimitMinutes: 90,
      contentPlacement: { isVisible: true }, requireSafeExamBrowser: false, gradeChallengesEnabled: true,
      gradebookSettings: { pointsPossible: 25, gradingMode: "pass_fail", passThresholdPoints: 15, passThresholdOutOf: 25, attemptLimitMode: "max_attempts", maxAttempts: 3, gradeStrategy: "best", dropLowestAttempt: true }
    })]);
    const assignment = { availableFrom: null, availableUntil: new Date(), metadata: { assessmentMode: "summative", requireSafeExamBrowser: true, existing: "kept" } };
    const effective = applyAssignmentExceptions(assignment, overrides);
    expect(effective).toEqual({ availableFrom: new Date("2026-01-01T00:00:00.000Z"), availableUntil: null, metadata: { assessmentMode: "summative", existing: "kept", requireSafeExamBrowser: false, gradeChallengesEnabled: true, timeLimitMinutes: 90 } });
    expect(applyGradebookExceptions({ id: "item", pointsPossible: 100, gradesReleased: false }, overrides)).toMatchObject({ id: "item", gradesReleased: false, pointsPossible: 25, maxAttempts: 3, gradeStrategy: "best", gradingMode: "pass_fail", passThresholdPoints: 15, passThresholdOutOf: 25, dropLowestAttempt: true });
    expect(assignment.metadata.requireSafeExamBrowser).toBe(true);
  });
  it("does not turn on summative-only access settings for a formative activity", () => {
    expect(applyAssignmentExceptions({ metadata: { assessmentMode: "formative" } }, { requireSafeExamBrowser: true, gradeChallengesEnabled: true }).metadata).toEqual({ assessmentMode: "formative" });
  });
  it("fails closed on an invalid saved exception", () => {
    expect(() => resolveAssignmentExceptions([team(0, { overrideFields: ["timeLimit"], timeLimitMinutes: -1 })])).toThrow("saved activity exception is invalid");
  });
  it("isolates participants and assignments when resolving a batch of gradebook exceptions", () => {
    const rows = [
      { id: "one", groupActivityId: "assignment", teamId: "team-a", participantId: null, priority: 0, settings: { overrideFields: ["timeLimit"], timeLimitMinutes: 20 }, team: { members: [{ participantId: "first" }] } },
      { id: "two", groupActivityId: "assignment", teamId: "team-b", participantId: null, priority: 1, settings: { overrideFields: ["timeLimit"], timeLimitMinutes: 30 }, team: { members: [{ participantId: "second" }] } },
      { id: "three", groupActivityId: "assignment", teamId: null, participantId: "second", priority: 2, settings: { overrideFields: ["timeLimit"], timeLimitMinutes: 40 }, team: null },
      { id: "four", groupActivityId: "another-assignment", teamId: null, participantId: "first", priority: 0, settings: { overrideFields: ["timeLimit"], timeLimitMinutes: 90 }, team: null }
    ];
    expect(exceptionsForParticipant(rows, "assignment", "first")).toEqual({ timeLimitMinutes: 20 });
    expect(exceptionsForParticipant(rows, "assignment", "second")).toEqual({ timeLimitMinutes: 40 });
    expect(exceptionsForParticipant(rows, "assignment", "unassigned")).toEqual({});
  });
});
