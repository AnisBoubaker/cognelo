import { beforeEach, expect, it, vi } from "vitest";
import type { StudentActivityExportInput } from "@cognelo/activity-sdk/server";
import { answerExportLabels } from "../../../../apps/api/src/lib/answer-export-labels";
const mocks = vi.hoisted(() => ({ evaluation: vi.fn() }));
vi.mock("./db-client", () => ({ prisma: { pluginMcqAiEvaluation: { findFirst: mocks.evaluation } } }));
import { exportStudentMcq } from "./submission-export";
const input = { user: { id: "learner" }, activity: { id: "activity", config: { source: "## Question\nChoose a city.\n\n- [x] Paris\n- [ ] London" } },
  labels: answerExportLabels("en"), attempt: null } as unknown as StudentActivityExportInput;
beforeEach(() => vi.resetAllMocks());
it("prints all public choices without identifying correct ones", async () => {
  const content = JSON.stringify(await exportStudentMcq(input));
  expect(content).toContain("Paris"); expect(content).toContain("London");
  expect(content).not.toMatch(/isCorrect|Correct answer|\[x\]/);
  expect(mocks.evaluation).not.toHaveBeenCalled();
});
it("uses the learner's saved choice and withholds the answer key even when feedback is released", async () => {
  const result = await exportStudentMcq({ ...input, attempt: { coreAttemptId: "attempt", pluginAttemptRef: null,
    state: null, metadata: { submittedAnswers: { "question-1": ["question-1-choice-2"] } }, feedback: { summary: "Released comment" }, includeGrading: true, includeAiFeedback: true } });
  expect(JSON.stringify(result)).toContain("☑ London");
  expect(JSON.stringify(result)).toContain("Released comment");
  expect(JSON.stringify(result)).not.toContain("Correct answer");
});
