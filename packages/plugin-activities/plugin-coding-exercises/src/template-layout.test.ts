import { describe, expect, it } from "vitest";
import { codingTemplateFiles, codingTemplateHasTestCode, codingTemplateLayoutIssues, placeCodingTemplateMarker } from "./template-layout";
import { codingExecutionSources } from "./coding-project";
import { parseCodingExerciseConfig, parseCodingExercisePrivateConfig } from "./coding-exercises";

const files = [
  { id: "main", name: "main.c", starterCode: "entry", studentTemplateSource: "{{ STUDENT_CODE }}" },
  { id: "case", name: "cases.c", starterCode: "demonstration", studentTemplateSource: "{{ STUDENT_CODE }}" }
];
describe("per-file template placement", () => {
  it("executes the fixture only where its marker is placed and respects a test-only file", () => {
    const config = parseCodingExerciseConfig({ prompt: "", files, language: "c" });
    const privateConfig = parseCodingExercisePrivateConfig({ templateSource: "{{ STUDENT_CODE }}", fileSources: {
      main: { templateSource: "prefix\n{{ STUDENT_CODE }}\nsuffix" },
      case: { templateSource: "support\n{{ TEST_CODE }}" }
    } });
    const original = files.map(file => ({ id: file.id, name: file.name, sourceCode: file.starterCode }));
    expect(codingExecutionSources({ config, privateConfig, sourceCode: "inspection", files: original, testCode: "fixture" }).files)
      .toEqual([{ name: "main.c", sourceCode: "prefix\nentry\nsuffix" }, { name: "cases.c", sourceCode: "support\nfixture" }]);
    expect(original[1].sourceCode).toBe("demonstration");
    expect(codingTemplateHasTestCode(config, privateConfig)).toBe(true);
    expect(codingTemplateFiles(config, privateConfig)[1].name).toBe("cases.c");
    privateConfig.fileSources!.case.templateSource = "";
    expect(codingExecutionSources({ config, privateConfig, sourceCode: "inspection", files: original }).files?.[1].sourceCode).toBe("");
  });
  it("rejects ambiguous fixtures and blanks that would never execute", () => {
    const config = parseCodingExerciseConfig({ prompt: "", files, language: "c", responseMode: "blanks" });
    const duplicate = parseCodingExercisePrivateConfig({ fileSources: Object.fromEntries(files.map(file => [file.id,
      { templateSource: "{{ STUDENT_CODE }}\n{{ TEST_CODE }}" }])) });
    expect(codingTemplateLayoutIssues(config, duplicate)).toContain("Place {{ TEST_CODE }} once across the file templates.");
    expect(() => codingExecutionSources({ config, privateConfig: duplicate, sourceCode: "", files: [], testCode: "test" })).toThrow("once across");
    const blank = { ...config, files: files.map(file => ({ ...file, blankTemplate: "{{ BLANK:answer }}" })) };
    expect(codingTemplateLayoutIssues(blank, parseCodingExercisePrivateConfig({ fileSources: {
      main: { templateSource: "{{ TEST_CODE }}" }, case: { templateSource: "{{ STUDENT_CODE }}" }
    } }))).toContain("main.c: include {{ STUDENT_CODE }} to execute the code containing blanks.");
  });
  it("moves an insertion marker to the selection on its own line", () => {
    const result = placeCodingTemplateMarker("{{ TEST_CODE }}\nint body() {\n}\n", "{{ TEST_CODE }}", 27, 27);
    expect(result.source.split("{{ TEST_CODE }}")).toHaveLength(2);
    expect(result.source.slice(result.cursor - "{{ TEST_CODE }}".length, result.cursor)).toBe("{{ TEST_CODE }}");
    expect(placeCodingTemplateMarker("old code", "{{ STUDENT_CODE }}", 0, 8).source).toBe("{{ STUDENT_CODE }}");
    expect(placeCodingTemplateMarker("def run():\n    ", "{{ TEST_CODE }}", 15, 15).source).toBe("def run():\n    {{ TEST_CODE }}");
  });
});
