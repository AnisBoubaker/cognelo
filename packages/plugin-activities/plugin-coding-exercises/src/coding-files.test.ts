import { describe, expect, it } from "vitest";
import { codingFilesSchema, codingFileNameSchema, defaultCodingFileName, formatCodingSourceFiles, referenceCodingFiles } from "./coding-files";
import { codingExecutionSources, resolveCodingFileInput } from "./coding-project";
import { parseCodingExerciseConfig, parseCodingExercisePrivateConfig } from "./coding-exercises";
import { getCodingExerciseStudentFiles, hasCodingExerciseAnswer } from "./web/coding-exercise-student-source";
import { gradeCodingBlanks } from "./blank-grading";

const files = [
  { id: "main", name: "main.py", starterCode: "from helper import compute\nprint(compute(2))", studentTemplateSource: "{{ STUDENT_CODE }}" },
  { id: "helper", name: "helper.py", starterCode: "def compute(n):\n    return 0", studentTemplateSource: "{{ STUDENT_CODE }}" }
];
const config = parseCodingExerciseConfig({ prompt: "Complete the helper function.", language: "python", files });
describe("programming file workspaces", () => {
  it.each([["c", "main.c"], ["cpp", "main.cpp"], ["python", "main.py"], ["java", "Main.java"], ["rust", "main.rs"], ["javascript", "main.js"]])("names the %s entry file appropriately", (language, name) => {
    expect(defaultCodingFileName(language)).toBe(name);
  });
  it("rejects traversal, shell metacharacters, wrapper names and case-colliding filenames", () => {
    for (const name of ["../other.c", "/main.py", "a/b.py", "a;whoami.c", "$(cmd).c", "compile", "run", ".env", "--option.c"]) expect(codingFileNameSchema.safeParse(name).success).toBe(false);
    expect(codingFilesSchema.safeParse([files[0], { ...files[1], name: "MAIN.PY" }]).success).toBe(false);
    expect(codingFilesSchema.safeParse([files[0], { ...files[1], id: "main" }]).success).toBe(false);
  });
  it("keeps file identity while taking names and visible scaffold only from teacher config", () => {
    const input = { sourceCode: "forged", files: [{ id: "main", name: "forged.py", sourceCode: "print(3)", studentTemplateSource: "private forged scaffold" }] };
    const result = resolveCodingFileInput(config, { ...input, blankTemplate: "{{ BLANK:forged }}", blankAnswers: { forged: "answer" } });
    expect(result).not.toHaveProperty("blankTemplate");
    expect(result).not.toHaveProperty("blankAnswers");
    expect(result.files).toEqual([{ id: "main", name: "main.py", sourceCode: "print(3)", studentTemplateSource: "{{ STUDENT_CODE }}" },
      { id: "helper", name: "helper.py", sourceCode: files[1].starterCode, studentTemplateSource: "{{ STUDENT_CODE }}" }]);
    expect(result.sourceCode).toBe(formatCodingSourceFiles(result.files!));
    expect(input.files[0].name).toBe("forged.py");
    expect(resolveCodingFileInput(config, { sourceCode: "" })).toMatchObject({ sourceCode: "", files: [{ sourceCode: "" }, { sourceCode: "" }] });
    expect(() => resolveCodingFileInput(config, { sourceCode: "", files: [{ id: "unknown", name: "unknown.py", sourceCode: "" }] })).toThrow("Reload");
  });
  it("tracks auxiliary-file work and restores it by ID after a rename without marking starter text answered", () => {
    const initial = getCodingExerciseStudentFiles(config);
    expect(hasCodingExerciseAnswer(config, { files: initial })).toBe(false);
    const edited = initial.map(file => file.id === "helper" ? { ...file, sourceCode: "def compute(n):\n    return n * 3" } : file);
    expect(hasCodingExerciseAnswer(config, { files: edited })).toBe(true);
    const renamed = { ...config, files: files.map(file => file.id === "helper" ? { ...file, name: "tools.py" } : file) };
    const restored = getCodingExerciseStudentFiles(renamed, { files: edited });
    expect(restored[1]).toMatchObject({ id: "helper", name: "tools.py", sourceCode: edited[1].sourceCode });
  });
  it("reconstructs all blank files and protects their fixed code and revisions", () => {
    const blankConfig = { ...config, responseMode: "blanks" as const, files: files.map((file, index) => ({ ...file,
      blankTemplate: index ? "return {{ BLANK:b }}" : "print({{ BLANK:a }})" })) };
    const snapshot = blankConfig.files.map(file => ({ id: file.id, name: file.name, sourceCode: "forged", blankTemplate: file.blankTemplate }));
    const result = resolveCodingFileInput(blankConfig, { sourceCode: "forged", files: snapshot, blankAnswers: { a: "1", b: "2" } });
    expect(result.files?.map(file => file.sourceCode)).toEqual(["print(1)", "return 2"]);
    expect(resolveCodingFileInput(blankConfig, { sourceCode: "", blankAnswers: {} }).sourceCode).toBe("");
    expect(() => resolveCodingFileInput(blankConfig, { sourceCode: "", files: snapshot.map(file => ({ ...file, blankTemplate: "stale" })) })).toThrow("template changed");
    expect(codingFilesSchema.safeParse(blankConfig.files.map(file => ({ ...file, blankTemplate: "{{ BLANK:duplicate }}" }))).success).toBe(false);
  });
  it("requires all blank revisions and bounds reconstructed source, including fixed code", () => {
    const definitions = Array.from({ length: 5 }, (_, i) => ({ id: `file${i}`, name: `file${i}.py`, starterCode: "",
      blankTemplate: "x".repeat(39900) + `{{ BLANK:b${i} }}`, studentTemplateSource: "{{ STUDENT_CODE }}" }));
    const large = parseCodingExerciseConfig({ prompt: "Complete the large workspace.", language: "python", responseMode: "blanks", files: definitions });
    const blankAnswers = Object.fromEntries(definitions.map((_, i) => [`b${i}`, "z".repeat(1000)]));
    expect(() => resolveCodingFileInput(large, { sourceCode: "", blankAnswers })).toThrow("full file workspace");
    expect(() => resolveCodingFileInput(large, { sourceCode: "", blankAnswers, files: definitions.map(file => ({ ...file, sourceCode: "" })) })).toThrow("200,000");
  });
  it("uses every private reference file, inserts the harness only in the entry, and does not exit from JS modules", () => {
    const privateConfig = parseCodingExercisePrivateConfig({ fileSources: {
      main: { referenceSolution: "entry", templateSource: "before\n{{ STUDENT_CODE }}\n{{ TEST_CODE }}" },
      helper: { referenceSolution: "helper", templateSource: "support\n{{ STUDENT_CODE }}" }
    } });
    const references = referenceCodingFiles(config, privateConfig, "legacy reference");
    expect(references.map(file => file.sourceCode)).toEqual(["entry", "helper"]);
    const built = codingExecutionSources({ config: { ...config, language: "javascript" }, privateConfig, sourceCode: "ignored", files: references, testCode: "HARNESS" });
    expect(built.files?.[0].sourceCode).toContain("HARNESS");
    expect(built.files?.[0].sourceCode).toContain("process.exit(0)");
    expect(built.files?.[1].sourceCode).toBe("support\nhelper");
  });
  it("isolates blanks across files while preserving the original response and credit for other files", async () => {
    const original = [{ ...files[0], sourceCode: "student1" }, { ...files[1], sourceCode: "bad(" }];
    const result = await gradeCodingBlanks({ template: "{{ BLANK:a }}\n{{ BLANK:b }}", answers: { a: "student1", b: "bad(" }, referenceAnswers: { a: "teacher1", b: "teacher2" },
      assembleSource: answers => original.map((file, index) => ({ ...file, sourceCode: answers[index ? "b" : "a"] })),
      runSuite: async sources => ({ summary: { accepted: !sources.some(file => file.sourceCode === "bad(") } }) });
    expect(result.grading).toMatchObject({ method: "isolated", correct: 1, total: 2 });
    expect(original.map(file => file.sourceCode)).toEqual(["student1", "bad("]);
  });
});
