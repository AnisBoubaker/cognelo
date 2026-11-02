import { describe, expect, it } from "vitest";
import { makeStudentQuestionContext, QUESTION_CONTEXT_LIMIT, studentQuestionContext } from "./question-context";
import { toStudentChallengeQuestionRecord } from "./generation";
const question = { id: "question", submissionId: "submission", orderIndex: 0, questionText: "Explain this function." };
describe("student question code context", () => {
  it("projects only the saved submitted code and provenance, never private prompt or retrieval data", () => {
    const result = toStudentChallengeQuestionRecord({ ...question, metadata: { prompt: "PRIVATE PROMPT", nearestExamples: ["PRIVATE SOLUTION"], studentCodeContext: { code: "int add(int a, int b) { return a + b; }", functionName: "add", filePath: "src/main.c", languageKey: "c", privateValue: "SECRET" } } });
    expect(result.context).toEqual({ code: "int add(int a, int b) { return a + b; }", functionName: "add", filePath: "src/main.c", languageKey: "c", truncated: false });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|SECRET|metadata|nearestExamples/);
  });
  it("supports already-generated questions through their retained function and validates both submission links", () => {
    const submissionFunction = { submissionId: "submission", functionName: "sum", functionCode: "int sum(void) { return 1; }", astText: "PRIVATE AST", file: { submissionId: "submission", path: "sum.c", languageKey: "c", storedName: "private-storage" } };
    expect(studentQuestionContext({ ...question, submissionFunction })).toMatchObject({ functionName: "sum", filePath: "sum.c" });
    expect(studentQuestionContext({ ...question, submissionFunction: { ...submissionFunction, submissionId: "someone-else" } })).toBeNull();
    expect(studentQuestionContext({ ...question, submissionFunction: { ...submissionFunction, file: { ...submissionFunction.file, submissionId: "someone-else" } } })).toBeNull();
  });
  it("keeps a bounded exact excerpt, marks truncation, and supports incomplete work without a parsed function", () => {
    const context = makeStudentQuestionContext({ code: "x".repeat(QUESTION_CONTEXT_LIMIT + 5), filePath: "main.c" });
    expect(context.code).toHaveLength(QUESTION_CONTEXT_LIMIT); expect(context.truncated).toBe(true);
    expect(studentQuestionContext({ ...question, metadata: { studentCodeContext: makeStudentQuestionContext({ code: "// incomplete\nint" }) } })).toMatchObject({ code: "// incomplete\nint", functionName: null, languageKey: "c" });
    expect(studentQuestionContext({ ...question, metadata: { studentCodeContext: { code: { secret: true } } } })).toBeNull();
  });
});
