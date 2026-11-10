import { applyAssignmentExceptions, resolveAssignmentExceptions } from "./activity-assignment-exceptions";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ definition: vi.fn(), configuration: vi.fn() }));
vi.mock("@cognelo/activity-sdk", () => ({ getActivityDefinition: mocks.definition }));
vi.mock("@cognelo/activity-sdk/server", () => ({ getActivitySubmissionStagesHandler: () => ({ configuration: mocks.configuration }) }));
import { normalizeSubmissionStageAssignmentMetadata, assertActivitySafeExamBrowserSupported, activitySubmissionStageSafeExamBrowser, activityAssessmentStageAssignment, getActivitySubmissionStageConfiguration, resolveActivitySubmissionStage, validateSubmissionStagePolicies, initialSubmissionStageMetadata, assertActivitySubmissionStageEnabled, configuredSubmissionStageActivations, submissionStageActivationResolver } from "./activity-submission-stages";
const activity = { id: "activity", activityType: { key: "staged" } }, names = { en: "First", fr: "Première", zh: "第一", ar: "الأولى" };
beforeEach(() => { vi.clearAllMocks(); mocks.definition.mockReturnValue({ submissionStages: [{ id: "files", names, allowsLateSubmissions: true }, { id: "questions", names, assessment: true }] }); mocks.configuration.mockResolvedValue({ defaults: { files: { deadline: "2030-01-01T10:00:00.000Z" } } }); });
describe("core stage capability resolution", () => {
  it("rebuilds direct section overrides instead of retaining an echoed stale activation map", async () => {
    const course = { allGroupsAssignment: { submissionStages: { files: { enabled: false }, questions: { enabled: false } } } };
    const before = normalizeSubmissionStageAssignmentMetadata("staged", course, { assessmentMode: "summative", submissionStages: { files: { enabled: true } } });
    const after = normalizeSubmissionStageAssignmentMetadata("staged", course, { ...before, submissionStages: { files: { enabled: false } } }, before);
    expect(after).toMatchObject({ submissionStageOverrides: { files: { enabled: false } }, submissionStages: { files: { enabled: false }, questions: { enabled: false } } });
    const policy = await resolveActivitySubmissionStage({ ...activity, metadata: course }, { metadata: after }, "files");
    expect(policy.policy.enabled).toBe(false);
  });
  it("honors legacy scalar edits when a section client echoes unchanged canonical values", () => {
    const before = { timeLimitMinutes: 20, requireSafeExamBrowser: true, submissionStages: { questions: { timeLimitMinutes: 20, requireSafeExamBrowser: true } } };
    const after = normalizeSubmissionStageAssignmentMetadata("staged", {}, { ...before, timeLimitMinutes: 40, requireSafeExamBrowser: false }, before);
    expect(after).toMatchObject({ submissionStageOverrides: { questions: { timeLimitMinutes: 40, requireSafeExamBrowser: false } } });
    const explicit = normalizeSubmissionStageAssignmentMetadata("staged", {}, { ...before, timeLimitMinutes: 40, submissionStages: { questions: { timeLimitMinutes: 25 } } }, before);
    expect(explicit).toMatchObject({ submissionStageOverrides: { questions: { timeLimitMinutes: 25 } } });
  });
  it("lets an activity or one stage disallow SEB and ignores incompatible stored flags", async () => {
    const declaration = mocks.definition.getMockImplementation()!();
    mocks.definition.mockReturnValue({ ...declaration, submissionStages: declaration.submissionStages.map((stage: { id: string }) => ({ ...stage, ...(stage.id === "files" ? { supportsSafeExamBrowser: false } : {}) })) });
    expect(() => validateSubmissionStagePolicies("staged", { files: { requireSafeExamBrowser: true } })).toThrow(expect.objectContaining({ code: "SUBMISSION_STAGE_SEB_UNSUPPORTED" }));
    expect(() => validateSubmissionStagePolicies("staged", { questions: { requireSafeExamBrowser: true } })).not.toThrow();
    const assignment = { metadata: { assessmentMode: "summative", submissionStages: { files: { requireSafeExamBrowser: true }, questions: { requireSafeExamBrowser: true } } } };
    expect((await activitySubmissionStageSafeExamBrowser(activity, assignment))?.requirements).toEqual({ files: false, questions: true });
    mocks.definition.mockReturnValue({ ...declaration, supportsSafeExamBrowser: false });
    expect(() => assertActivitySafeExamBrowserSupported("staged", true)).toThrow(expect.objectContaining({ code: "SAFE_EXAM_BROWSER_UNSUPPORTED" }));
    expect(() => validateSubmissionStagePolicies("staged", { questions: { requireSafeExamBrowser: true } })).toThrow(expect.objectContaining({ code: "SUBMISSION_STAGE_SEB_UNSUPPORTED" }));
    expect((await activitySubmissionStageSafeExamBrowser(activity, assignment))?.requirements).toEqual({ files: false, questions: false });
  });
  for (const files of [false, true]) for (const questions of [false, true]) it(`resolves independent SEB policies: files=${files}, questions=${questions}`, async () => {
    const assignment = { metadata: { assessmentMode: "summative", submissionStages: { files: { requireSafeExamBrowser: files }, questions: { requireSafeExamBrowser: questions } } } };
    expect(await activitySubmissionStageSafeExamBrowser(activity, assignment)).toEqual({ requirements: { files, questions }, assessmentRequired: questions });
  });
  it("maps old SEB settings to assessment only and honors explicit stage settings and exceptions", async () => {
    expect(await activitySubmissionStageSafeExamBrowser(activity, { metadata: { assessmentMode: "summative", requireSafeExamBrowser: true } })).toMatchObject({ requirements: { files: false, questions: true } });
    const configured = { ...activity, metadata: { allGroupsAssignment: { requireSafeExamBrowser: true, submissionStages: { questions: { requireSafeExamBrowser: true } } } } };
    const assignment = { metadata: { assessmentMode: "summative", requireSafeExamBrowser: true, submissionStageOverrides: {}, overrideFields: [], submissionStages: { questions: { requireSafeExamBrowser: true } } } };
    const legacyException = applyAssignmentExceptions(assignment, { requireSafeExamBrowser: false });
    expect((await activitySubmissionStageSafeExamBrowser(configured, legacyException))?.assessmentRequired).toBe(false);
    const explicit = applyAssignmentExceptions(assignment, { requireSafeExamBrowser: false, submissionStages: { files: { requireSafeExamBrowser: true }, questions: { requireSafeExamBrowser: true } } });
    expect((await activitySubmissionStageSafeExamBrowser(configured, explicit))?.requirements).toEqual({ files: true, questions: true });
    expect((await activitySubmissionStageSafeExamBrowser(configured, { metadata: { ...assignment.metadata, submissionStages: { questions: { requireSafeExamBrowser: false } } } }))?.assessmentRequired).toBe(false);
  });
  it("preserves team priority and student precedence when old and new SEB exception formats mix", async () => {
    const legacy = (required: boolean) => ({ overrideFields: ["requireSafeExamBrowser"], requireSafeExamBrowser: required });
    const canonical = (required: boolean) => ({ submissionStages: { questions: { requireSafeExamBrowser: required } } });
    const team = (priority: number, settings: unknown) => ({ groupActivityId: "assignment", teamId: `team-${priority}`, participantId: null, priority, settings });
    const student = (settings: unknown) => ({ groupActivityId: "assignment", teamId: null, participantId: "student", priority: 0, settings });
    for (const [rows, expected] of [
      [[team(1, canonical(true)), team(0, legacy(false))], false],
      [[team(1, legacy(true)), team(0, canonical(false))], false],
      [[team(0, legacy(false)), student(canonical(true))], true],
      [[team(0, canonical(true)), student(legacy(false))], false]
    ] as const) {
      const overrides = resolveAssignmentExceptions(rows);
      const assignment = applyAssignmentExceptions({ metadata: { assessmentMode: "summative" } }, overrides);
      expect((await activitySubmissionStageSafeExamBrowser(activity, assignment))?.assessmentRequired).toBe(expected);
    }
  });
  it("retains older section SEB overrides even after stage timing was configured", async () => {
    const configured = { ...activity, metadata: { allGroupsAssignment: { requireSafeExamBrowser: false, submissionStages: { questions: { timeLimitMinutes: 10, requireSafeExamBrowser: false } } } } };
    for (const overrideFields of [undefined, ["requireSafeExamBrowser"]]) {
      const metadata = { assessmentMode: "summative", requireSafeExamBrowser: true, overrideFields, timeLimitMinutes: 10, submissionStages: { questions: { timeLimitMinutes: 10 } }, submissionStageOverrides: {} };
      expect((await activitySubmissionStageSafeExamBrowser(configured, { metadata }))?.assessmentRequired).toBe(true);
    }
  });
  it("ignores SEB on disabled workflow stages and formative work", async () => {
    const assignment = { metadata: { assessmentMode: "summative", submissionStages: { files: { requireSafeExamBrowser: true }, questions: { requireSafeExamBrowser: true } } } };
    mocks.configuration.mockResolvedValue({ activeStageIds: ["files"] });
    expect((await activitySubmissionStageSafeExamBrowser(activity, assignment))?.requirements).toEqual({ files: true, questions: false });
    expect((await activitySubmissionStageSafeExamBrowser(activity, { metadata: { ...assignment.metadata, assessmentMode: "formative" } }))?.requirements).toEqual({ files: false, questions: false });
    mocks.definition.mockReturnValue({});
    expect(await activitySubmissionStageSafeExamBrowser(activity, assignment)).toBeNull();
  });
  it("requires explicit activation for new generic staged activities without changing ordinary metadata", () => {
    expect(initialSubmissionStageMetadata("staged", { custom: "retained" })).toEqual({ custom: "retained", allGroupsAssignment: { submissionStages: { files: { enabled: false }, questions: { enabled: false } } } });
    mocks.definition.mockReturnValue({});
    expect(initialSubmissionStageMetadata("ordinary", { custom: "retained" })).toEqual({ custom: "retained" });
  });
  it("retains legacy activation, applies overrides independently and keeps timing while a stage is off", async () => {
    expect((await assertActivitySubmissionStageEnabled(activity, { metadata: {} }, "questions")).policy.enabled).toBe(true);
    const assignment = { metadata: { timeLimitMinutes: 10, submissionStages: { questions: { enabled: false } } } };
    await expect(assertActivitySubmissionStageEnabled(activity, assignment, "questions")).rejects.toMatchObject({ code: "SUBMISSION_STAGE_NOT_ACTIVATED" });
    expect((await activityAssessmentStageAssignment(activity, assignment)).metadata.timeLimitMinutes).toBe(10);
    expect((await resolveActivitySubmissionStage(activity, applyAssignmentExceptions(assignment, { submissionStages: { questions: { enabled: true } } }), "questions")).policy.enabled).toBe(true);
  });
  it("counts only available stages and assigned overrides when preparing plugin delivery", async () => {
    const configuration = await getActivitySubmissionStageConfiguration(activity);
    const general = { files: { enabled: false }, questions: { enabled: false } };
    expect(configuredSubmissionStageActivations(configuration, general, [{ assigned: false, submissionStages: { questions: { enabled: true } } }])).toEqual({ files: false, questions: false });
    expect(configuredSubmissionStageActivations(configuration, general, [{ assigned: true, exceptions: [{ submissionStages: { questions: { enabled: true } } }] }])).toEqual({ files: false, questions: true });
    configuration.stages[1].active = false;
    expect(configuredSubmissionStageActivations(configuration, { questions: { enabled: true } }, [])).toMatchObject({ questions: false });
  });
  it("resolves transactional per-student activation and rejects missing enrollment", async () => {
    const configuration = await getActivitySubmissionStageConfiguration(activity), query = vi.fn();
    query.mockResolvedValueOnce([{ activityMetadata: { allGroupsAssignment: { submissionStages: { questions: { enabled: false } } } }, assignmentMetadata: { submissionStages: { questions: { enabled: true } } }, assignmentId: "assignment", participantId: "participant" }]);
    query.mockResolvedValueOnce([{ settings: { submissionStages: { questions: { enabled: false } } } }]);
    const enabled = submissionStageActivationResolver({ $queryRaw: query }, activity.id, configuration);
    expect(await enabled({ groupId: "section", userId: "student", stageId: "questions" })).toBe(false);
    query.mockResolvedValueOnce([]);
    expect(await enabled({ groupId: "foreign-section", userId: "student", stageId: "questions" })).toBe(false);
  });
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
