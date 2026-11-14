import { describe, expect, it } from "vitest";
import { homeworkGuideState } from "./homework-submission-guide-state";
import type { HomeworkWorkspace } from "./workflow-types";
const base: HomeworkWorkspace = { questionGenerationEnabled: true, submissionsEnabled: true, questionsStageEnabled: true, previousCancelled: false, submission: null };
const active: NonNullable<HomeworkWorkspace["submission"]> = { id: "s", status: "challenge_ready", started: false, questionGenerationEnabled: true, createdAt: "2026-11-14T12:00:00Z", processingStatus: "succeeded", queuePosition: null, questionCount: 3, files: [], incompleteAcknowledged: false };
describe("homework stage guidance", () => {
  it("uses the authored mode before hand-in and the frozen mode afterwards", () => {
    expect(homeworkGuideState({ ...base, questionGenerationEnabled: false }, false, 0).questionsRequired).toBe(false);
    expect(homeworkGuideState({ ...base, questionGenerationEnabled: false, submission: active }, false, 0).questionsRequired).toBe(true);
    expect(homeworkGuideState({ ...base, submission: { ...active, questionGenerationEnabled: false, status: "ready_for_grading" } }, false, 0)).toMatchObject({ questionsRequired: false, complete: true, files: "submitted" });
  });
  it("keeps generated-but-inactive questions distinct from disabled questions", () => {
    expect(homeworkGuideState({ ...base, submissionsEnabled: false, questionsStageEnabled: false }, false, 0)).toMatchObject({ questionsRequired: true, files: "waiting", questions: "waiting" });
    expect(homeworkGuideState({ ...base, questionsStageEnabled: false, submission: active }, false, 0)).toMatchObject({ files: "submitted", questions: "waiting" });
  });
  it("preserves answering and completion when a teacher later closes stages", () => {
    expect(homeworkGuideState({ ...base, questionsStageEnabled: false, submission: { ...active, started: true } }, true, 0)).toMatchObject({ files: "submitted", questions: "active" });
    expect(homeworkGuideState({ ...base, questionsStageEnabled: false, submission: { ...active, started: true, status: "ready_for_grading" } }, true, 0)).toMatchObject({ complete: true, questions: "done" });
  });
  it("distinguishes work not handed in, generation, failure, ready questions and elapsed deadlines", () => {
    expect(homeworkGuideState(base, false, 0).questions).toBe("next");
    expect(homeworkGuideState({ ...base, submission: { ...active, status: "uploaded", processingStatus: "queued" } }, false, 0).questions).toBe("generating");
    expect(homeworkGuideState({ ...base, submission: { ...active, status: "failed", processingStatus: "failed" } }, false, 0).questions).toBe("failed");
    expect(homeworkGuideState({ ...base, submission: { ...active, processingStatus: "failed" } }, false, 0).questions).toBe("ready");
    expect(homeworkGuideState({ ...base, questionsClosesAt: "2026-11-14T12:00:00Z", submission: active }, false, Date.parse("2026-11-14T12:00:01Z")).questions).toBe("closed");
  });
});
