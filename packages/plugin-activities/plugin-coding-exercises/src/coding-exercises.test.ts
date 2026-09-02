import { describe, expect, it } from "vitest";
import {
  alignCodingExerciseStarterCodeToTemplate,
  buildCodingExerciseSource,
  buildCodingExerciseStudentTemplateSource,
  buildCodingExerciseTemplateSource,
  codingExerciseHiddenTestsInputSchema,
  codingExerciseTemplateRequiresTestCodeMarker,
  getJudge0LanguageCandidates,
  parseCodingExerciseConfig,
  parseCodingExercisePrivateConfig,
  splitCodingExerciseTemplateSource
} from "./coding-exercises";

describe("coding exercise config and template helpers", () => {
  it("normalizes legacy execution modes to template mode", () => {
    expect(
      parseCodingExerciseConfig({
        prompt: "Write a function that adds two numbers.",
        executionMode: "function",
        language: "python"
      }).executionMode
    ).toBe("template");
  });

  it("keeps legacy sample and hidden tests on exact output matching", () => {
    const config = parseCodingExerciseConfig({
      prompt: "Write a function that adds two numbers.",
      sampleTests: [{ id: "sample-1", input: "", output: "2", testCode: "", title: "Sample" }]
    });
    const hidden = codingExerciseHiddenTestsInputSchema.parse({
      referenceSolution: "print(2)",
      tests: [{ id: "hidden-1", name: "Hidden", expectedOutput: "2" }]
    });

    expect(config.sampleTests[0]).toMatchObject({ outputMatchMode: "exact", containsLinesOrderMatters: false });
    expect(hidden.tests[0]).toMatchObject({ outputMatchMode: "exact", containsLinesOrderMatters: false });
  });

  it("merges hidden support code into private template source", () => {
    const privateConfig = parseCodingExercisePrivateConfig({
      hiddenSupportCode: "def helper():\n    return 1",
      templateSource: "{{ STUDENT_CODE }}"
    });

    expect(privateConfig.templateSource).toContain("def helper()");
    expect(privateConfig.templateSource).toContain("{{ STUDENT_CODE }}");
    expect(privateConfig.hiddenSupportCode).toBe("");
  });

  it("builds runnable source by injecting student and test code into the template", () => {
    expect(
      buildCodingExerciseSource({
        config: { executionMode: "template", language: "python" },
        privateConfig: {
          hiddenSupportCode: "",
          templateSource: "def solve():\n    {{ STUDENT_CODE }}\n\n{{ TEST_CODE }}",
          templateVisibleLineNumbers: [],
          templatePrefix: "",
          templateSuffix: ""
        },
        studentSourceCode: "return 42",
        testCode: "print(solve())"
      })
    ).toContain("    return 42");
  });

  it("requires a test-code marker when tests provide harness code", () => {
    expect(codingExerciseTemplateRequiresTestCodeMarker("{{ STUDENT_CODE }}", [{ testCode: "print(solve())" }])).toBe(true);
    expect(codingExerciseTemplateRequiresTestCodeMarker("{{ STUDENT_CODE }}\n{{ TEST_CODE }}", [{ testCode: "print(solve())" }])).toBe(false);
  });

  it("projects hidden template lines into language-appropriate placeholders", () => {
    expect(
      buildCodingExerciseStudentTemplateSource("def helper():\n    return 1\n{{ STUDENT_CODE }}", [0], "python")
    ).toContain("# Hidden code");
  });

  it("aligns starter code indentation with the student insertion marker", () => {
    expect(alignCodingExerciseStarterCodeToTemplate("return 1", "def solve():\n    {{ STUDENT_CODE }}")).toBe("    return 1");
  });

  it("maps Judge0 language keys to supported runtime candidates", () => {
    expect(getJudge0LanguageCandidates(" Python ").languageKey).toBe("python");
    expect(() => getJudge0LanguageCandidates("brainfuck")).toThrow("Unsupported coding exercise language");
  });

  it("normalizes hidden test payloads", () => {
    const parsed = codingExerciseHiddenTestsInputSchema.parse({
      referenceSolution: "print('ok')",
      privateConfig: {
        templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}"
      },
      tests: [
        {
          id: "hidden-1",
          name: "Hidden",
          stdin: "",
          expectedOutput: "ok",
          testCode: "print('ok')",
          isEnabled: false,
          weight: 2
        }
      ],
      validateOnly: true
    });

    expect(parsed.tests[0]).toMatchObject({ id: "hidden-1", isEnabled: false, weight: 2, testCode: "print('ok')" });
  });

  it("splits and rebuilds template source around a single student marker", () => {
    const source = buildCodingExerciseTemplateSource("before\n", "\nafter");
    expect(source).toContain("before");
    expect(source).toContain("{{ STUDENT_CODE }}");
    expect(source).toContain("after");
    expect(splitCodingExerciseTemplateSource(source)).toEqual({
      prefix: "before\n\n\n",
      suffix: "\n\n\nafter"
    });
    expect(splitCodingExerciseTemplateSource("no marker")).toEqual({ prefix: "no marker", suffix: "" });
  });
});
