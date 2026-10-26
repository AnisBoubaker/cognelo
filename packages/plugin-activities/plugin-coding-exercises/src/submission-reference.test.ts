import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ child: vi.fn(), execution: vi.fn() }));
vi.mock("@cognelo/db", () => ({ prisma: { testItemAttempt: { findFirst: mocks.child } } }));
vi.mock("./db-client", () => ({ prisma: { pluginCodingExerciseExecution: { findFirst: mocks.execution } } }));
import { resolveCodingTestSubmission } from "./submission-reference";

const input = { courseId: "course", activityId: "question", parentAttemptId: "parent", itemAttemptId: "child" };
const child = (pluginAttemptRef: string | null = null, state: Record<string, unknown> = { executionId: "execution", sourceCode: "print(1)" }) => ({
  pluginAttemptRef, result: { state }, parentAttempt: { userId: "learner" }
});

describe("submitted Test coding evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.child.mockResolvedValue(child());
    mocks.execution.mockResolvedValue({ id: "execution", sourceCode: "print(1)" });
  });

  it.each([null, "execution"])("resolves verified evidence with reference %s without writes or code execution", async (ref) => {
    mocks.child.mockResolvedValue(child(ref));
    await expect(resolveCodingTestSubmission(input)).resolves.toBe("execution");
    expect(mocks.child).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: "child", activityId: "question", parentAttemptId: "parent", lifecycle: { in: ["submitted", "graded"] },
      parentAttempt: { courseId: "course", pluginKey: "core:test", assessmentMode: "summative", lifecycle: { in: ["submitted", "graded"] } }
    } }));
    expect(mocks.execution).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: "execution", activityId: "question", userId: "learner", kind: "submit"
    } }));
  });

  it("rejects missing, deleted, unsubmitted, or differently scoped child attempts", async () => {
    mocks.child.mockResolvedValue(null);
    await expect(resolveCodingTestSubmission(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_SUBMISSION_REQUIRED" });
    expect(mocks.execution).not.toHaveBeenCalled();
  });

  it("requires automatic grading to prepare recovered answers without an execution", async () => {
    mocks.child.mockResolvedValue(child(null, { sourceCode: "print(1)" }));
    await expect(resolveCodingTestSubmission(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_SUBMISSION_REQUIRED" });
    expect(mocks.execution).not.toHaveBeenCalled();
  });

  it("rejects conflicting references instead of selecting a different submission", async () => {
    mocks.child.mockResolvedValue(child("other-execution"));
    await expect(resolveCodingTestSubmission(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_EXECUTION_NOT_FOUND" });
    expect(mocks.execution).not.toHaveBeenCalled();
  });

  it("rejects absent executions, practice runs, and another learner's or activity's evidence", async () => {
    mocks.execution.mockResolvedValue(null);
    await expect(resolveCodingTestSubmission(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_EXECUTION_NOT_FOUND" });
  });

  it("rejects source mismatches but accepts an intentionally empty submitted answer", async () => {
    mocks.execution.mockResolvedValue({ id: "execution", sourceCode: "different source" });
    await expect(resolveCodingTestSubmission(input)).rejects.toMatchObject({ code: "CODING_EXERCISE_EXECUTION_NOT_FOUND" });
    mocks.child.mockResolvedValue(child(null, { executionId: "execution", sourceCode: "" }));
    mocks.execution.mockResolvedValue({ id: "execution", sourceCode: "" });
    await expect(resolveCodingTestSubmission(input)).resolves.toBe("execution");
  });
});
