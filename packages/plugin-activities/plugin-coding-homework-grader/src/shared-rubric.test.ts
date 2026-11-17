import { describe, expect, it, vi } from "vitest";
import { calculateHomeworkFeedback, defaultHomeworkGrading, homeworkFeedbackDraft } from "./rubric";
vi.mock("@cognelo/core", () => ({ AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }, hashAiFeedbackValue: (value: unknown) => JSON.stringify(value) }));
vi.mock("./file-preparation", () => ({ record: (value: unknown) => value && typeof value === "object" ? value : {} }));
vi.mock("./rubric-grading", () => ({ homeworkRubricGradingResult: (feedback: { combinedScore: number }) => ({ rawScore: feedback.combinedScore, rawMaxScore: 100 }) }));
const { homeworkSharedGrading } = await import("./shared-rubric");
const criterion = { id: "quality", title: "Quality", description: "", weightPercent: 100 };
function feedback() {
  const draft = homeworkFeedbackDraft({ ...defaultHomeworkGrading(), enabled: true, code: { criteria: [criterion], instructions: "" }, questions: { criteria: [criterion], instructions: "" } }, ["personal-question"]);
  draft.code.criteria[0].scorePercent = 80; draft.questions[0].criteria[0].scorePercent = 40;
  return calculateHomeworkFeedback(draft);
}
describe("shared homework rubric boundary", () => {
  it("merges only the code component and preserves individual answers, question scores and narrative", () => {
    const current = { ...feedback(), summary: "Individual comment" };
    const code = { ...current.code, criteria: [{ ...current.code.criteria[0], scorePercent: 60 }] };
    const merged = homeworkSharedGrading.mergeFeedback(current, code, "revision", "new-policy");
    expect(merged.feedback).toMatchObject({ codeScore: 60, questionsScore: 40, combinedScore: 54, summary: "Individual comment", privateCodePolicyHash: "new-policy" });
    expect(merged.feedback.questions).toEqual(current.questions);
  });
  it("publishes under a source lock and targets only current member/submission bindings", async () => {
    const query = vi.fn().mockResolvedValueOnce([{ sharedSourceId: "source" }]).mockResolvedValueOnce([{ metadata: {} }]).mockResolvedValueOnce([{ coreAttemptId: "own" }, { coreAttemptId: "peer" }]);
    const execute = vi.fn().mockResolvedValue(1), rubric = feedback();
    const peers = await homeworkSharedGrading.synchronize({ activityId: "activity", groupId: "group", pluginAttemptRef: "child", feedback: rubric, transaction: { query: query as never, execute } });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[1][0].join(" ")).toContain("FOR UPDATE OF s");
    expect(query.mock.calls[2][0].join(" ")).toContain('m."currentSubmissionId"=s.id');
    expect(peers.map(peer => peer.attemptId)).toEqual(["own", "peer"]);
  });
  it("rejects replaced workspaces and competing code revisions before publishing", async () => {
    const execute = vi.fn();
    const input = { activityId: "activity", groupId: "group", pluginAttemptRef: "child", feedback: feedback() };
    const query = vi.fn().mockResolvedValueOnce([{ sharedSourceId: "source" }]).mockResolvedValueOnce([]);
    await expect(homeworkSharedGrading.synchronize({ ...input, transaction: { query: query as never, execute } })).rejects.toMatchObject({ code: "HOMEWORK_SHARED_SUBMISSION_CHANGED" });
    query.mockResolvedValueOnce([{ sharedSourceId: "source" }]).mockResolvedValueOnce([{ metadata: { sharedCodeRubric: { revision: "changed" } } }]);
    await expect(homeworkSharedGrading.synchronize({ ...input, transaction: { query: query as never, execute } })).rejects.toMatchObject({ code: "HOMEWORK_SHARED_GRADING_CONFLICT" });
    expect(execute).not.toHaveBeenCalled();
  });
});
