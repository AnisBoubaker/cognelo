import { beforeEach, expect, it, vi } from "vitest";
import type { SubmissionExportInput } from "@cognelo/activity-sdk/server";
const mocks = vi.hoisted(() => ({ execution: vi.fn(), tests: vi.fn(), evaluation: vi.fn() }));
vi.mock("./db-client", () => ({ prisma: { pluginCodingExerciseExecution: { findFirst: mocks.execution }, pluginCodingExerciseAiEvaluation: { findFirst: mocks.evaluation } } }));
vi.mock("./executions", () => ({ getLatestCodingExerciseTestResult: mocks.tests }));
import { exportCodingSubmission } from "./submission-export";
const input = { userId: "student", coreAttemptId: "attempt", pluginAttemptRef: "execution", activity: { id: "activity", config: { language: "c" } }, state: null, metadata: {}, feedback: {}, includePrompt: false, includeGrading: false, labels: { noAnswer: "No answer", tests: "Tests", test: "Test", result: "Result", weight: "Weight", comments: "Comments", passed: "Passed", failed: "Failed", summary: "Summary" } } as unknown as SubmissionExportInput;
beforeEach(() => { vi.resetAllMocks(); mocks.execution.mockResolvedValue({ id: "execution", sourceCode: "student source", resultSummary: {} }); });
it("exports the exact stored source without consulting grading when disabled", async () => {
  expect((await exportCodingSubmission(input)).answer).toMatchObject([{ text: "student source" }]);
  expect(mocks.execution).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "execution", activityId: "activity", userId: "student" } }));
  expect(mocks.tests).not.toHaveBeenCalled(); expect(mocks.evaluation).not.toHaveBeenCalled();
});
it("uses latest saved tests and stored formative feedback without executing graders", async () => {
  mocks.tests.mockResolvedValue({ resultSummary: { tests: [{ name: "new test", passed: true, weight: 2 }] } });
  mocks.evaluation.mockResolvedValue({ sanitizedFeedback: { summary: "Saved feedback" } });
  const result = await exportCodingSubmission({ ...input, includeGrading: true });
  expect(result.grading).toMatchObject([{ rows: [["new test", "Passed", "2", ""]] }, { text: "Saved feedback" }]);
});
it("preserves recovered saved source when a timeout has no execution record", async () => {
  const result = await exportCodingSubmission({ ...input, pluginAttemptRef: null, state: { sourceCode: "recovered answer" } });
  expect(result.answer).toMatchObject([{ text: "recovered answer" }]);
});
