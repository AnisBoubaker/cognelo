import { describe, expect, it, vi } from "vitest";
const getPrivateConfig = vi.hoisted(() => vi.fn());
vi.mock("./executions", () => ({ getCodingExercisePrivateConfig: getPrivateConfig }));
const { getCodingExerciseGradeCompletions } = await import("./grade-completion");

async function completion(policy: Record<string, unknown>, feedback: Record<string, unknown> = {}, gradeSource = "auto") {
  getPrivateConfig.mockResolvedValue({ aiFeedback: policy });
  return getCodingExerciseGradeCompletions({ activityId: "activity", rows: [{ participantId: "student", gradeSource,
    gradingResult: {}, feedback }] } as unknown as Parameters<typeof getCodingExerciseGradeCompletions>[0]);
}

describe("enabled grading components", () => {
  it("keeps a rubric-only grade at zero of one components until it is assessed", async () => {
    expect(await completion({ gradingEnabled: true, testsEnabled: false, testWeightPercent: 0 }))
      .toEqual({ student: { status: "partial", completedComponentCount: 0, requiredComponentCount: 1 } });
  });
  it("keeps combined test-only evidence partial at one of two components", async () => {
    expect(await completion({ gradingEnabled: true, testsEnabled: true, testWeightPercent: 60 }))
      .toEqual({ student: { status: "partial", completedComponentCount: 1, requiredComponentCount: 2 } });
  });
  it("accepts an assessed zero rubric score and a teacher override as complete", async () => {
    const policy = { gradingEnabled: true, testsEnabled: false, testWeightPercent: 0 };
    expect(await completion(policy, { aiScore: 0 })).toEqual({ student: { status: "complete", completedComponentCount: 1, requiredComponentCount: 1 } });
    expect(await completion(policy, {}, "override")).toEqual({ student: { status: "complete", completedComponentCount: 1, requiredComponentCount: 1 } });
  });
});
