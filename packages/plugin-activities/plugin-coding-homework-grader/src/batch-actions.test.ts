import { describe, expect, it } from "vitest";
import { homeworkBatchRevision, resetHomeworkGenerationMetadata } from "./batch-actions";
type Assignment = Parameters<typeof resetHomeworkGenerationMetadata>[1];
const assignment = { id: "assignment", activityId: "activity", candidateLimit: 5, languageKey: "c", promptMarkdown: "Current prompt", generationInstructions: "Current directions", questionCount: 4, retrievedExampleCount: 3, settings: { preparedSnapshotId: "current" }, promptPdfAttachmentId: null, createdAt: new Date(0), updatedAt: new Date(0) } satisfies Assignment;
describe("homework class-wide reset policy", () => {
  it("retains the frozen hand-in and baseline while replacing only question-generation state", () => {
    const submissionTiming = { submittedAt: "2026-01-01T12:00:00Z", deadline: "2026-01-01T11:00:00Z", isLate: true, lateByMs: 3600000 };
    const old = { handInAt: submissionTiming.submittedAt, submissionTiming, providedCode: { version: 1, functions: [] }, draftRevision: 9, folders: ["src"],
      questionLanguage: "fr", assessmentStartedAt: "old-clock", challengeAnswers: ["Retained on old assessment"], challengeGeneration: { old: true }, cancellation: {}, deletion: {},
      assignment: { generationInstructions: "Old directions" }, questionGenerationAi: { model: "old" } };
    const result = resetHomeworkGenerationMetadata(old, assignment, { model: "current-model" }, "operation", "old-assessment", "teacher", "Correct references");
    expect(result).toMatchObject({ handInAt: old.handInAt, submissionTiming, providedCode: old.providedCode, draftRevision: 9, folders: ["src"], questionLanguage: "fr",
      fileHandInId: "old-assessment", resetFrom: "old-assessment", questionGenerationAi: { model: "current-model" }, assignment: { generationInstructions: "Current directions", questionCount: 4 } });
    for (const key of ["assessmentStartedAt", "challengeAnswers", "challengeGeneration", "cancellation", "deletion"]) expect(result).not.toHaveProperty(key);
    expect(old.challengeAnswers).toEqual(["Retained on old assessment"]);
    expect(resetHomeworkGenerationMetadata({ ...result }, assignment, {}, "second-operation", "new-assessment", "teacher", "Again").fileHandInId).toBe("old-assessment");
  });
  it("requires a new confirmation when a submission, answering participation or saved reference changes", () => {
    const target = { participantId: "person", groupId: "section", userId: "student", submissionId: "submission", coreAttemptId: null, questionsEnabled: true, team: false };
    const before = homeworkBatchRevision("reset-question-generation", [target], assignment);
    expect(homeworkBatchRevision("reset-question-generation", [{ ...target, submissionId: "replacement" }], assignment)).not.toBe(before);
    expect(homeworkBatchRevision("reset-question-generation", [{ ...target, coreAttemptId: "started" }], assignment)).not.toBe(before);
    expect(homeworkBatchRevision("reset-question-generation", [target], { ...assignment, settings: { preparedSnapshotId: "corrected" } })).not.toBe(before);
    const cancel = homeworkBatchRevision("cancel-all-submissions", [target], assignment);
    expect(homeworkBatchRevision("cancel-all-submissions", [target], { ...assignment, generationInstructions: "New instructions" })).toBe(cancel);
  });
});
