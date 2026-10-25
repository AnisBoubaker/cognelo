import { expect, it } from "vitest";
import { projectMcqConfig, readMcqConfig, hasMcqAnswer, reconcileMcqResponseState, mcqSelectedFeedback } from "./mcq";

it("projects readable single/multiple choice questions without keys or private authoring fields", () => {
  const config = { source: "## Choose\nPick two\n- [x] A\n- [x] B\n- [ ] C", aiFeedbackInstructions: "private", aiGenerationInstructions: "private" };
  const projected = projectMcqConfig(config);
  expect(JSON.stringify(projected)).not.toMatch(/isCorrect|\[x\]|source|private|Instructions/);
  expect(readMcqConfig(projected).questions[0].mode).toBe("multiple");
  const answers = { "question-1": ["question-1-choice-1"] };
  expect(hasMcqAnswer(projected, { answers })).toBe(true);
  expect(reconcileMcqResponseState(projected, projected, { answers })).toEqual({ answers });
  expect(mcqSelectedFeedback(config, answers).selectedChoiceCorrectness).toEqual({ "question-1": { "question-1-choice-1": true } });
});

it("retains partial-credit points without disclosing unselected correct choices", async () => {
  const { withMcqSelectedFeedback } = await import("./mcq");
  const config = { source: "## Choose\nPick two\n- [x] A\n- [x] B\n- [ ] C" };
  const answers = { "question-1": ["question-1-choice-1"] };
  const feedback = mcqSelectedFeedback(config, answers);
  const displayed = withMcqSelectedFeedback(readMcqConfig(projectMcqConfig(config)), feedback);
  expect(displayed.questions[0].learnerGrade).toEqual({ score: 0.5, pointUnit: 0.5 });
  expect(displayed.questions[0].choices.map((choice) => choice.isCorrect)).toEqual([true, undefined, undefined]);
});
