import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), connection: vi.fn(), research: vi.fn(),
  attempt: vi.fn(), previous: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock("@cognelo/core", async () => ({ ...await vi.importActual<typeof import("@cognelo/core")>("@cognelo/core"),
  generateAiAgentText: mocks.generate, getCourseAssessmentFeedbackAiAgentConnection: mocks.connection,
  recordAiFeedbackResearchEvent: mocks.research }));
vi.mock("@cognelo/db", () => ({ prisma: { activityAttempt: { findFirst: mocks.attempt } } }));
vi.mock("./db-client", () => ({ prisma: { pluginMcqAiEvaluation: {
  findFirst: mocks.previous, create: mocks.create, update: mocks.update
} } }));
import { evaluateMcqWithAi } from "./ai-feedback";

describe("MCQ teacher instruction priority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.connection.mockResolvedValue({ id: "connection", model: "model", provider: "openai" });
    mocks.attempt.mockResolvedValue({ userId: "learner", participantId: "participant", gradebookItemId: "gradebook", groupActivityId: "assignment" });
    mocks.create.mockResolvedValue({ id: "evaluation", version: 1 });
    mocks.update.mockResolvedValue({ id: "evaluation", version: 1 });
    mocks.generate.mockResolvedValue(JSON.stringify({ summary: "Brief feedback", questionFeedback: [{ questionId: "question-1", explanation: "Reviewed answer" }] }));
  });
  it("promotes the saved feedback instructions without promoting question text or changing deterministic grades", async () => {
    const instructions = "Use one short sentence and acknowledge the learner's reasoning.";
    const result = await evaluateMcqWithAi({
      user: { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] },
      courseId: "course", groupId: "group", activityId: "activity", coreAttemptId: "attempt", assessmentMode: "summative", triggerKind: "test_child",
      activity: { id: "activity", title: "Question", description: "", lifecycle: "published", activityType: { key: "mcq", name: "MCQ", description: "" },
        config: { source: "## Addition\nStudent-facing question text.\n- [x] Four\n- [ ] Five", aiFeedbackEnabled: true, aiFeedbackInstructions: instructions } },
      answers: { "question-1": ["question-1-choice-1"] }
    });
    const input = mocks.generate.mock.calls[0][1];
    expect(input.systemPrompt).toContain(instructions);
    expect(input.systemPrompt).toContain("highest priority");
    expect(input.systemPrompt).toContain("Do not alter or propose a grade");
    expect(input.systemPrompt).not.toContain("Student-facing question text.");
    expect(JSON.parse(input.userPrompt).instructions).toBe(instructions);
    expect(result.gradingResult).toBeUndefined();
  });
});
