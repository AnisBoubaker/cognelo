import { describe, expect, it } from "vitest";
import { hasMcqAnswer, parseMcqSource } from "@cognelo/plugin-mcq";
import { hasParsonsAnswer } from "@cognelo/plugin-parsons";
import { hasCodingExerciseAnswer } from "@cognelo/plugin-coding-exercises";
import { hasWebDesignExerciseAnswer } from "@cognelo/plugin-web-design-coding-exercises";

describe("Test review response presence (never correctness)", () => {
  it("requires a choice for every MCQ question, treating right and wrong choices equally", () => {
    const config = { source: "## One\nChoose\n- [x] A\n- [ ] B\n\n## Two\nChoose\n- [x] C\n- [ ] D" };
    const questions = parseMcqSource(config.source, "none").questions;
    expect(hasMcqAnswer(config, null)).toBe(false);
    expect(hasMcqAnswer(config, { answers: { [questions[0]!.id]: [questions[0]!.choices[0]!.id] } })).toBe(false);
    for (const index of [0, 1]) {
      expect(hasMcqAnswer(config, { answers: Object.fromEntries(questions.map((question) => [question.id, [question.choices[index]!.id]])) })).toBe(true);
    }
    expect(hasMcqAnswer(config, { answers: Object.fromEntries(questions.map((question) => [question.id, []])) })).toBe(false);
  });

  it("does not count initialized/reset Parsons arrangements as answers, and retains legacy drafts", () => {
    expect(hasParsonsAnswer({}, null)).toBe(false);
    expect(hasParsonsAnswer({}, { blocks: [{}], hasAnswer: false })).toBe(false);
    expect(hasParsonsAnswer({}, { blocks: [{}], hasAnswer: true, lastEvaluation: { isCorrect: false } })).toBe(true);
    expect(hasParsonsAnswer({}, { blocks: [{}] })).toBe(true);
  });

  it("ignores empty or unchanged coding starters, including template indentation", () => {
    const config = { language: "python", prompt: "Write your answer", starterCode: "pass", studentTemplateSource: "def answer():\n    {{ STUDENT_CODE }}" };
    expect(hasCodingExerciseAnswer(config, null)).toBe(false);
    expect(hasCodingExerciseAnswer(config, { sourceCode: "    pass" })).toBe(false);
    expect(hasCodingExerciseAnswer(config, { sourceCode: "  \n " })).toBe(false);
    expect(hasCodingExerciseAnswer(config, { sourceCode: "    invalid code is still an answer" })).toBe(true);
  });

  it("counts only nonempty edits to editable web-design files", () => {
    const files = [
      { id: "html", path: "index.html", language: "html", starterCode: "<p>Starter</p>", isEditable: true },
      { id: "css", path: "styles.css", language: "css", starterCode: "p {}", isEditable: false }
    ];
    const config = { files };
    expect(hasWebDesignExerciseAnswer(config, null)).toBe(false);
    expect(hasWebDesignExerciseAnswer(config, { files })).toBe(false);
    expect(hasWebDesignExerciseAnswer(config, { files: [{ ...files[0], starterCode: " " }] })).toBe(false);
    expect(hasWebDesignExerciseAnswer(config, { files: [{ ...files[1], starterCode: "p {color: red}" }] })).toBe(false);
    expect(hasWebDesignExerciseAnswer(config, { files: [{ ...files[0], starterCode: "An unfinished response" }] })).toBe(true);
  });
});
