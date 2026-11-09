import { applyAssignmentExceptions } from "./activity-assignment-exceptions";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ definition: vi.fn(), configuration: vi.fn() }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: mocks.definition }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivitySubmissionStagesHandler: () => ({ configuration: mocks.configuration }) }));
import { activityAssessmentStageAssignment, getActivitySubmissionStageConfiguration, resolveActivitySubmissionStage, validateSubmissionStagePolicies } from "./activity-submission-stages";
const activity = { id: "activity", activityType: { key: "staged" } }, names = { en: "First", fr: "Première", zh: "第一", ar: "الأولى" };
beforeEach(() => { vi.clearAllMocks(); mocks.definition.mockReturnValue({ submissionStages: [{ id: "files", names, allowsLateSubmissions: true }, { id: "questions", names, assessment: true }] }); mocks.configuration.mockResolvedValue({ defaults: { files: { deadline: "2030-01-01T10:00:00.000Z" } } }); });
describe("core stage capability resolution", () => {
  it("uses plugin names, ordered IDs and active stages, without concrete plugin imports", async () => {
    mocks.configuration.mockResolvedValue({ activeStageIds: ["files"] });
    expect((await getActivitySubmissionStageConfiguration(activity)).stages).toMatchObject([{ id: "files", names, active: true }, { id: "questions", active: false }]);
    expect((await activityAssessmentStageAssignment(activity, { metadata: { timeLimitMinutes: 25 } })).metadata.timeLimitMinutes).toBeNull();
  });
  it("preserves legacy defaults until core settings explicitly replace or clear them", async () => {
    expect((await resolveActivitySubmissionStage(activity, { metadata: {} }, "files")).policy.deadline).toBe("2030-01-01T10:00:00.000Z");
    expect((await resolveActivitySubmissionStage(activity, { metadata: { submissionStages: { files: { deadline: null } } } }, "files")).policy.deadline).toBeNull();
  });
  it("new section placements inherit core General stage policy", async () => {
    const withGeneral = { ...activity, metadata: { allGroupsAssignment: { submissionStages: { questions: { deadline: "2030-01-01T11:00:00.000Z" } } } } };
    expect((await resolveActivitySubmissionStage(withGeneral, { metadata: {} }, "questions")).window.deadline).toBe("2030-01-01T11:00:00.000Z");
  });
  it("leaves ordinary activities unchanged and does not call a plugin service", async () => {
    mocks.definition.mockReturnValue({}); const assignment = { metadata: {}, availableUntil: new Date() };
    expect(await activityAssessmentStageAssignment(activity, assignment)).toBe(assignment); expect(mocks.configuration).not.toHaveBeenCalled();
  });
  it("caps the assessment deadline and preserves optional legacy duration", async () => {
    const value = await activityAssessmentStageAssignment(activity, { availableUntil: new Date("2030-01-01T12:00:00Z"), metadata: { timeLimitMinutes: 10, submissionStages: { questions: { deadline: "2030-01-01T11:00:00Z" } } } });
    expect(value.availableUntil?.toISOString()).toBe("2030-01-01T11:00:00.000Z"); expect(value.metadata.timeLimitMinutes).toBe(10);
  });
  it("separates an assessment stage's late cutoff from its due date", async () => {
    mocks.definition.mockReturnValue({ submissionStages: [{ id: "questions", names, assessment: true, allowsLateSubmissions: true }] });
    const value = await activityAssessmentStageAssignment(activity, { availableUntil: new Date("2030-01-01T12:00:00Z"), metadata: { submissionStages: { questions: { deadline: "2030-01-01T10:00:00Z", allowLate: true, lateLimitMinutes: 60 } } } });
    expect(value.availableUntil?.toISOString()).toBe("2030-01-01T11:00:00.000Z");
    expect(value.metadata).toMatchObject({ submissionStageDeadline: "2030-01-01T10:00:00.000Z" });
  });
  it("explicitly clears the legacy duration", async () => {
    const value = await activityAssessmentStageAssignment(activity, { metadata: { timeLimitMinutes: 10, submissionStages: { questions: { timeLimitMinutes: null } } } });
    expect(value.metadata.timeLimitMinutes).toBeNull();
  });
  it("preserves legacy section durations until a canonical override is explicitly cleared", async () => {
    const withGeneral = { ...activity, metadata: { allGroupsAssignment: { timeLimitMinutes: 20, submissionStages: { questions: { timeLimitMinutes: 20 } } } } };
    const legacy = { timeLimitMinutes: 60, overrideFields: ["timeLimit"], submissionStages: { questions: { timeLimitMinutes: 20 } } };
    expect((await resolveActivitySubmissionStage(withGeneral, { metadata: legacy }, "questions")).policy.timeLimitMinutes).toBe(60);
    expect((await resolveActivitySubmissionStage(withGeneral, { metadata: { ...legacy, submissionStageExceptionOverrides: { questions: { timeLimitMinutes: 15 } } } }, "questions")).policy.timeLimitMinutes).toBe(15);
    expect((await resolveActivitySubmissionStage(withGeneral, { metadata: { ...legacy, submissionStageOverrides: {} } }, "questions")).policy.timeLimitMinutes).toBe(20);
    const exception = applyAssignmentExceptions({ metadata: { timeLimitMinutes: 20, overrideFields: [], submissionStages: { questions: { timeLimitMinutes: 20 } }, submissionStageOverrides: {} } }, { timeLimitMinutes: 90 });
    expect((await resolveActivitySubmissionStage(withGeneral, exception, "questions")).policy.timeLimitMinutes).toBe(90);
  });
  it("rejects undeclared stages and late policy on an unsupported stage", () => {
    expect(() => validateSubmissionStagePolicies("staged", { unknown: {} })).toThrow("declared submission stage");
    expect(() => validateSubmissionStagePolicies("staged", { questions: { allowLate: true } })).toThrow("does not accept late");
    expect(() => validateSubmissionStagePolicies("staged", { files: { deadline: "2030-01-01T09:00:00Z" } }, "2030-01-01T10:00:00Z")).toThrow("precede");
  });
});
