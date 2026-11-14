import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ activity: vi.fn(), stage: vi.fn() }));
vi.mock("@cognelo/core", () => ({ getGroupAssignedActivity: mocks.activity, resolveActivitySubmissionStage: mocks.stage, activityAssessmentStageAssignment: vi.fn() }));
import { homeworkFileStageSettings } from "./stage-scheduling";
const scope = { user: {} as never, courseId: "course", groupId: "group", activityId: "activity" };
const policy = { enabled: true, deadline: null, timeLimitMinutes: null, allowLate: false, lateLimitMinutes: null, requireSafeExamBrowser: false };
describe("student homework timing information", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.activity.mockResolvedValue({ assignment: { metadata: { assessmentMode: "summative" } } }); });
  const stages = (question: Record<string, unknown>, active = true) => mocks.stage.mockResolvedValueOnce({ stage: { active: true }, policy, availableUntil: null })
    .mockResolvedValueOnce({ stage: { active }, policy: { ...policy, ...question }, availableUntil: "2026-11-14T15:00:00Z" });
  it("shows the planned question time/deadline even before teacher activation", async () => {
    stages({ enabled: false, timeLimitMinutes: 30, deadline: "2026-11-14T16:00:00Z", requireSafeExamBrowser: true });
    expect(await homeworkFileStageSettings(scope)).toMatchObject({ questionGenerationEnabled: true, questionsStageEnabled: false, questionsTimeLimitMinutes: 30, questionsDeadline: "2026-11-14T15:00:00.000Z", questionsClosesAt: "2026-11-14T15:00:00.000Z", questionsRequireSafeExamBrowser: true });
  });
  it("derives the current close from the original answering start without restarting it", async () => {
    stages({ enabled: false, timeLimitMinutes: 30 });
    expect(await homeworkFileStageSettings(scope, null, "2026-11-14T12:00:00Z")).toMatchObject({ questionsStageEnabled: false, questionsClosesAt: "2026-11-14T12:30:00.000Z" });
  });
  it("omits hidden question requirements in file-only mode", async () => {
    stages({ timeLimitMinutes: 30, requireSafeExamBrowser: true }, false);
    expect(await homeworkFileStageSettings(scope)).toMatchObject({ questionGenerationEnabled: false, questionsTimeLimitMinutes: null, questionsDeadline: null, questionsClosesAt: null, questionsRequireSafeExamBrowser: false });
  });
  it("does not claim SEB is required in a formative assignment", async () => {
    mocks.activity.mockResolvedValue({ assignment: { metadata: { assessmentMode: "formative" } } });
    stages({ requireSafeExamBrowser: true });
    expect((await homeworkFileStageSettings(scope)).questionsRequireSafeExamBrowser).toBe(false);
  });
});
