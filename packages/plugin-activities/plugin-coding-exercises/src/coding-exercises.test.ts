import { describe, expect, it } from "vitest";
import {
  alignCodingExerciseStarterCodeToTemplate,
  balanceCodingExerciseAiRubricCriterionWeights,
  buildCodingExerciseSource,
  buildCodingExerciseStudentTemplateProjectionFromSource,
  buildCodingExerciseStudentTemplateSource,
  buildCodingExerciseTemplateSource,
  codingExerciseHiddenTestsInputSchema,
  createCodingExerciseAiRubricCriterionId,
  codingExerciseTemplateRequiresTestCodeMarker,
  getJudge0LanguageCandidates,
  getCodingExerciseAiFeedbackValidationMessages,
  mergeCodingExerciseGeneratedSolutionPrivateConfig,
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
    expect(config.language).toBe("");
    expect(hidden.tests[0]).toMatchObject({ outputMatchMode: "exact", containsLinesOrderMatters: false });
  });

  it("accepts at most fifteen visible tests", () => {
    const sampleTests = Array.from({ length: 15 }, (_, index) => ({
      id: `sample-${index + 1}`,
      title: `Sample ${index + 1}`,
      input: String(index),
      output: String(index)
    }));

    expect(parseCodingExerciseConfig({
      prompt: "Write a program that echoes the provided value.",
      sampleTests
    }).sampleTests).toHaveLength(15);
    expect(() => parseCodingExerciseConfig({
      prompt: "Write a program that echoes the provided value.",
      sampleTests: [...sampleTests, { id: "sample-16", title: "Sample 16", input: "15", output: "15" }]
    })).toThrow();
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

  it("requires a complete weighted rubric when automatic feedback or rubric grading is enabled", () => {
    expect(() => parseCodingExercisePrivateConfig({
      templateSource: "{{ STUDENT_CODE }}",
      aiFeedback: {
        enabled: true,
        gradingEnabled: true,
        instructions: "Evaluate the submitted approach.",
        testWeightPercent: 60,
        aiWeightPercent: 40,
        criteria: [{ id: "quality", title: "Quality", description: "Readable and maintainable code.", weightPercent: 90 }]
      }
    })).toThrow("Rubric criterion weights must total 100%.");

    expect(parseCodingExercisePrivateConfig({
      templateSource: "{{ STUDENT_CODE }}",
      aiFeedback: {
        enabled: true,
        gradingEnabled: true,
        instructions: "Evaluate the submitted approach.",
        testWeightPercent: 60,
        aiWeightPercent: 40,
        criteria: [{ id: "quality", title: "Quality", description: "Readable and maintainable code.", weightPercent: 100 }]
      }
    }).aiFeedback).toMatchObject({ enabled: true, gradingEnabled: true, testWeightPercent: 60, aiWeightPercent: 40 });
  });

  it("keeps a teacher-authored rubric valid when automatic feedback is disabled", () => {
    expect(parseCodingExercisePrivateConfig({
      templateSource: "{{ STUDENT_CODE }}",
      aiFeedback: {
        enabled: false,
        gradingEnabled: true,
        instructions: "",
        testWeightPercent: 70,
        aiWeightPercent: 30,
        criteria: [{ id: "quality", title: "Quality", description: "Evaluate the submitted approach.", weightPercent: 100 }]
      }
    }).aiFeedback).toMatchObject({ enabled: false, gradingEnabled: true });
  });

  it("preserves the rubric when a generated solution replaces the private template", () => {
    const current = parseCodingExercisePrivateConfig({
      templateSource: "old\n{{ STUDENT_CODE }}",
      templateVisibleLineNumbers: [0],
      aiFeedback: {
        enabled: true,
        gradingEnabled: true,
        instructions: "Evaluate the solution.",
        testWeightPercent: 60,
        aiWeightPercent: 40,
        criteria: [{ id: "quality", title: "Quality", description: "Evaluate code quality.", weightPercent: 100 }]
      }
    });

    const merged = mergeCodingExerciseGeneratedSolutionPrivateConfig(current, {
      templateSource: "new\n{{ STUDENT_CODE }}\n{{ TEST_CODE }}",
      templateVisibleLineNumbers: [0, 2]
    });

    expect(merged.templateSource).toBe("new\n{{ STUDENT_CODE }}\n{{ TEST_CODE }}");
    expect(merged.templateVisibleLineNumbers).toEqual([0, 2]);
    expect(merged.aiFeedback).toEqual(current.aiFeedback);
  });

  it("reports incomplete rubric drafts before they are sent to the API", () => {
    expect(getCodingExerciseAiFeedbackValidationMessages({
      enabled: true,
      gradingEnabled: true,
      instructions: "",
      testWeightPercent: 60,
      aiWeightPercent: 40,
      criteria: []
    })).toEqual(expect.arrayContaining([
      "Feedback instructions are required when AI feedback is enabled.",
      "At least one rubric criterion is required when rubric feedback or grading is enabled."
    ]));
  });

  it("creates unique criterion ids and keeps editor-generated weights at 100 percent", () => {
    const criteria = [
      { id: "criterion-1", title: "One", description: "First", weightPercent: 50 },
      { id: "criterion-3", title: "Three", description: "Third", weightPercent: 50 }
    ];
    const generatedId = createCodingExerciseAiRubricCriterionId(criteria);
    expect(generatedId).toMatch(/^criterion-/);
    expect(criteria.map((criterion) => criterion.id)).not.toContain(generatedId);
    expect(balanceCodingExerciseAiRubricCriterionWeights([
      ...criteria,
      { id: generatedId, title: "Two", description: "Second", weightPercent: 1 }
    ])).toEqual([
      { ...criteria[0], weightPercent: 34 },
      { ...criteria[1], weightPercent: 33 },
      { id: generatedId, title: "Two", description: "Second", weightPercent: 33 }
    ]);
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
          templateSuffix: "",
          aiFeedback: { enabled: false, gradingEnabled: false, instructions: "", testWeightPercent: 60, aiWeightPercent: 40, criteria: [] }
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
    expect(buildCodingExerciseStudentTemplateSource("helper\n{{ STUDENT_CODE }}", [], "common-lisp")).toContain("; Hidden code");
    expect(buildCodingExerciseStudentTemplateSource("helper\n{{ STUDENT_CODE }}", [], "sql")).toContain("-- Hidden code");
  });

  it("omits hidden blank scaffold lines from the student editor", () => {
    expect(
      buildCodingExerciseStudentTemplateSource(
        "{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}",
        [],
        "python"
      )
    ).toBe("{{ STUDENT_CODE }}");
  });

  it("normalizes legacy whitespace-only protected boundaries", () => {
    expect(
      buildCodingExerciseStudentTemplateProjectionFromSource("\n{{ STUDENT_CODE }}\n\n")
    ).toEqual({ readOnlyPrefix: "", readOnlySuffix: "" });
  });

  it("aligns starter code indentation with the student insertion marker", () => {
    expect(alignCodingExerciseStarterCodeToTemplate("return 1", "def solve():\n    {{ STUDENT_CODE }}")).toBe("    return 1");
  });

  it("maps Judge0 language keys to supported runtime candidates", () => {
    const python = getJudge0LanguageCandidates(" Python ");
    expect(python.languageKey).toBe("python");
    expect(python.candidates[0]).toBe("Python (3.12.7)");
    expect(getJudge0LanguageCandidates("javascript").candidates[0]).toBe("JavaScript (Node.js 22.8.0)");
    expect(getJudge0LanguageCandidates("typescript").candidates[0]).toBe("TypeScript (5.6.3)");
    expect(getJudge0LanguageCandidates("java").candidates[0]).toBe("Java (OpenJDK 17.0.12)");
    expect(getJudge0LanguageCandidates("go").candidates[0]).toBe("Go (1.22.7)");
    expect(getJudge0LanguageCandidates("brainfuck")).toEqual({ languageKey: "brainfuck", candidates: [] });
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
