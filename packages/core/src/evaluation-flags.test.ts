import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ flags: vi.fn(), authorize: vi.fn() }));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginEvaluationFlagHandler: (key: string) => key === "flag-provider" ? mocks.flags : null }));
vi.mock("./authorization", () => ({ assertCanGradeGroup: mocks.authorize }));
import { getGradebookEvaluationFlags, evaluationFlagRowKey } from "./evaluation-flags";
const user = { id: "teacher", roles: ["teacher"] } as CurrentUser;
const row = { activityId: "activity", activityTypeKey: "flag-provider", groupId: "section", participantId: "student", assessmentMode: "summative", feedback: null, gradeCompletionContext: { gradingResult: {} },
  attempts: [{ id: "attempt", lifecycle: "submitted", assessmentMode: "summative", attemptNumber: 1, pluginAttemptRef: "private-submission" }] };
const flag = { kind: "possible_unauthorized_assistance" as const, reasonCode: "provider-low-answer", messages: { en: "Review these answers." } };
beforeEach(() => { vi.clearAllMocks(); mocks.flags.mockResolvedValue({ student: [flag], foreign: [flag] }); });
describe("core evaluation flags", () => {
  it("projects plugin-neutral flags for submitted work without requiring a grade", async () => {
    const result = await getGradebookEvaluationFlags(user, "course", [row]);
    expect(result.get(evaluationFlagRowKey(row))).toEqual([flag]);
    expect(result.size).toBe(1);
    expect(mocks.authorize).toHaveBeenCalledWith(user, "course", "section");
    expect(mocks.flags).toHaveBeenCalledWith(expect.objectContaining({ rows: [expect.objectContaining({ attemptId: "attempt", pluginAttemptRef: "private-submission" })] }));
  });
  it("omits formative, unsupported, deleted and reopened work without reading private evidence", async () => {
    const result = await getGradebookEvaluationFlags(user, "course", [
      { ...row, assessmentMode: "formative" }, { ...row, activityTypeKey: "unsupported" },
      { ...row, attempts: [{ ...row.attempts[0], lifecycle: "deleted" }] },
      { ...row, attempts: [{ ...row.attempts[0], lifecycle: "started" }] }
    ]);
    expect(result.size).toBe(0); expect(mocks.flags).not.toHaveBeenCalled();
  });
  it("uses current attempt feedback before a grade exists and rejects a foreign feedback binding", async () => {
    const feedback = { kind: "provider", answerScore: 90 };
    await getGradebookEvaluationFlags(user, "course", [{ ...row, gradeCompletionContext: { gradingResult: {}, evaluationFeedback: { attemptId: "attempt", feedback } } }]);
    expect(mocks.flags.mock.calls[0][0].rows[0].feedback).toEqual(feedback);
    await getGradebookEvaluationFlags(user, "course", [{ ...row, gradeCompletionContext: { gradingResult: {}, evaluationFeedback: { attemptId: "foreign", feedback } } }]);
    expect(mocks.flags.mock.calls[1][0].rows[0].feedback).toBeNull();
    await getGradebookEvaluationFlags(user, "course", [{ ...row, feedback: { kind: "old-selected" }, gradeCompletionContext: {
      gradingResult: { studentFeedback: { kind: "old-selected" } }, evaluationAttemptId: "older-attempt", evaluationFeedback: { attemptId: "attempt", feedback }
    } }]);
    expect(mocks.flags.mock.calls[2][0].rows[0]).toMatchObject({ feedback, gradingResult: {} });
  });
  it("rechecks section grading permission and refuses private extra fields in a flag", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("Outside section"));
    await expect(getGradebookEvaluationFlags(user, "course", [row])).rejects.toThrow("Outside section");
    expect(mocks.flags).not.toHaveBeenCalled();
    mocks.flags.mockResolvedValueOnce({ student: [{ ...flag, privateEvidence: "not a staff DTO" }] });
    await expect(getGradebookEvaluationFlags(user, "course", [row])).rejects.toThrow();
  });
});
