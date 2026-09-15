import { describe, expect, it } from "vitest";
import { getCodingExerciseInitialStudentSource } from "./coding-exercise-student-source";

describe("coding exercise student source initialization", () => {
  it("uses the starter code from the selected question config", () => {
    const firstQuestion = {
      prompt: "First question prompt",
      language: "python",
      starterCode: "return 'first'",
      studentTemplateSource: "def first():\n    {{ STUDENT_CODE }}"
    };
    const secondQuestion = {
      prompt: "Second question prompt",
      language: "python",
      starterCode: "return 'second'",
      studentTemplateSource: "# Hidden code\ndef second():\n    {{ STUDENT_CODE }}"
    };

    expect(getCodingExerciseInitialStudentSource(firstQuestion)).toBe("    return 'first'");
    expect(getCodingExerciseInitialStudentSource(secondQuestion)).toBe("    return 'second'");
  });
});
