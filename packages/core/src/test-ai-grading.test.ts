import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";

const mocks = vi.hoisted(() => ({ context: vi.fn(), contexts: vi.fn(), review: vi.fn(), owner: vi.fn(),
  complete: vi.fn(), submission: vi.fn() }));
vi.mock("./gradebook", () => ({ getActivityAttemptRegradeContext: mocks.context, getActivityAttemptRegradeContexts: mocks.contexts }));
vi.mock("./test-execution", () => ({ getTestAttemptReview: mocks.review }));
vi.mock("./ai-feedback", async () => ({ ...await vi.importActual<typeof import("./ai-feedback")>("./ai-feedback"),
  getTeacherAttemptAiFeedbackReview: mocks.owner }));
vi.mock("@cognelo/activity-sdk/server", () => ({
  resolvePluginAiGradingBatchHandler: (type: string) => type === "coding-exercise" ? { isTemplateComplete: mocks.complete } : null,
  resolvePluginAiFeedbackTeacherReviewHandler: (type: string) => type === "coding-exercise" ? { getSubmission: mocks.submission } : null
}));
import { prepareTestAiGradingTemplates, resolveTestAiGradingGuidance } from "./test-ai-grading";

const teacher = { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
const context = (id: string, lifecycle = "graded") => ({ attemptId: id, activityId: "test", activityTypeKey: "test", lifecycle, attemptNumber: 1 });
const question = (id: string, complete = true) => ({ testItemId: id, activityId: `activity-${id}`, activityTypeKey: "coding-exercise",
  activity: { id: `activity-${id}`, description: "Task", config: { prompt: id } },
  itemAttempt: { id: `child-${id}`, lifecycle: "graded", pluginAttemptRef: `execution-${id}`, state: { sourceCode: `source-${id}` },
    feedback: { aiFeedback: { summary: `Reviewed ${id}`, complete } } } });
const review = (id: string, items = [question("one"), question("two")]) => ({ id, groupId: "section", items });

describe("Test AI grading templates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockImplementation(async (_user, _course, id) => context(id, id === "target" ? "submitted" : "graded"));
    mocks.contexts.mockResolvedValue([context("template"), context("pending", "submitted")]);
    mocks.review.mockImplementation(async (_user, _course, id) => review(id));
    mocks.owner.mockResolvedValue({ participant: { name: "Teacher-visible learner name" } });
    mocks.complete.mockImplementation(async input => input.feedback.complete === true);
    mocks.submission.mockImplementation(async input => ({ sourceCode: `${input.coreAttemptId}/${input.activityId}` }));
  });

  it("offers graded Test examples with question coverage and no shared instructions", async () => {
    const result = await prepareTestAiGradingTemplates(teacher, "course", "test", ["template", "pending"]);
    expect(result).toEqual({ available: true, instructions: null, templates: [{ attemptId: "template",
      participantName: "Teacher-visible learner name", attemptNumber: 1, questionCount: 2 }] });
    expect(mocks.submission).not.toHaveBeenCalled();
  });

  it("matches stable question identities even when learner question order differs", async () => {
    mocks.review.mockImplementation(async (_user, _course, id) => review(id,
      id === "template" ? [question("two"), question("one")] : [question("one"), question("two")]));
    const { guidance } = await resolveTestAiGradingGuidance(teacher, "course", "target", ["template"]);
    expect(guidance.get("one")).toEqual({ templates: [{ coreAttemptId: "template",
      submission: { sourceCode: "template/activity-one" }, feedback: { summary: "Reviewed one", complete: true } }] });
    expect(guidance.get("two")?.templates[0].submission.sourceCode).toBe("template/activity-two");
    expect(guidance.get("one")).not.toHaveProperty("instructions");
    expect(mocks.submission.mock.calls[0][0]).toMatchObject({ coreAttemptId: "template", activityId: "activity-one",
      testItemAttempt: { id: "child-one", state: { sourceCode: "source-one" } } });
  });

  it("uses only complete matching question examples in a mixed Test", async () => {
    mocks.review.mockImplementation(async (_user, _course, id) => review(id, [question("one"), question("two", id === "target")]));
    const { guidance } = await resolveTestAiGradingGuidance(teacher, "course", "target", ["template"]);
    expect([...guidance.keys()]).toEqual(["one"]);
    expect(mocks.submission).toHaveBeenCalledTimes(1);
  });

  it.each([["target"], ["template", "template"], ["a", "b", "c", "d"]].map(ids => ({ ids })))("rejects self-reassessment, duplicates and excessive templates: $ids", async ({ ids }) => {
    await expect(resolveTestAiGradingGuidance(teacher, "course", "target", ids)).rejects.toMatchObject({ status: 400 });
    expect(mocks.submission).not.toHaveBeenCalled();
  });

  it("rejects other Tests, unfinished examples and unauthorized submissions before loading answers", async () => {
    mocks.context.mockImplementation(async (_user, _course, id) => ({ ...context(id), activityId: id === "template" ? "other-test" : "test" }));
    await expect(resolveTestAiGradingGuidance(teacher, "course", "target", ["template"])).rejects.toMatchObject({ code: "AI_BATCH_TEMPLATE_INVALID" });
    mocks.context.mockImplementation(async (_user, _course, id) => context(id, "submitted"));
    await expect(resolveTestAiGradingGuidance(teacher, "course", "target", ["template"])).rejects.toMatchObject({ code: "AI_BATCH_TEMPLATE_INVALID" });
    mocks.context.mockRejectedValue(new AppError(403, "FORBIDDEN", "Denied"));
    await expect(resolveTestAiGradingGuidance(teacher, "course", "target", ["template"])).rejects.toMatchObject({ status: 403 });
    expect(mocks.submission).not.toHaveBeenCalled();
  });

  it("revalidates cleared feedback and changed question content instead of using stale examples", async () => {
    await prepareTestAiGradingTemplates(teacher, "course", "test", ["template"]);
    mocks.complete.mockResolvedValue(false);
    await expect(resolveTestAiGradingGuidance(teacher, "course", "target", ["template"])).rejects.toMatchObject({ code: "AI_BATCH_TEMPLATE_INCOMPLETE" });
    mocks.complete.mockResolvedValue(true);
    mocks.review.mockImplementation(async (_user, _course, id) => review(id,
      ["one", "two"].map(key => ({ ...question(key), activity: { ...question(key).activity, config: { prompt: `${id}/${key}` } } }))));
    await expect(resolveTestAiGradingGuidance(teacher, "course", "target", ["template"])).rejects.toMatchObject({ code: "AI_BATCH_TEMPLATE_INCOMPLETE" });
    expect(mocks.submission).not.toHaveBeenCalled();
  });
});
