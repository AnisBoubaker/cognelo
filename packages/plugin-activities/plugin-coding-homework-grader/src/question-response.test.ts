import { describe, expect, it } from "vitest";
import { parseChallengeQuestionResponse } from "./question-response";

const context = { targetFunction: "student_render", excludedNames: ["provided_lookup"], previousQuestions: [] as string[] };
describe("challenge response validation", () => {
  it("accepts a question about the student's guard before a provided helper call", () => {
    const text = "Dans `student_render`, pourquoi vérifier solution != NULL avant d’appeler `provided_lookup`, et quel cas cette condition protège-t-elle ?";
    expect(parseChallengeQuestionResponse(JSON.stringify({ questionText: text }), context)).toEqual({ ok: true, text });
  });
  it("rejects a provided helper as the target even if the student function is mentioned later", () => {
    const text = "Explain how provided_lookup computes its result when called by student_render.";
    expect(parseChallengeQuestionResponse(JSON.stringify({ questionText: text }), context)).toMatchObject({ ok: false, reason: "provided_function_target", feedback: expect.stringContaining("student_render") });
  });
  it("returns actionable format and length feedback instead of accepting malformed output", () => {
    for (const output of ["not JSON", "{truncated"]) expect(parseChallengeQuestionResponse(output, context)).toMatchObject({ ok: false, reason: "invalid_json" });
    for (const output of ["null", "[]", '{"questionText":3}', '{"questionText":"Too short."}']) expect(parseChallengeQuestionResponse(output, context)).toMatchObject({ ok: false, reason: "invalid_question" });
  });
  it("accepts fenced JSON and rejects a repeated trimmed question", () => {
    const text = "Explain why the function initializes its counter before the loop.";
    expect(parseChallengeQuestionResponse('```json\n' + JSON.stringify({ questionText: text }) + '\n```', context)).toEqual({ ok: true, text });
    expect(parseChallengeQuestionResponse(JSON.stringify({ questionText: `  ${text}  ` }), { ...context, previousQuestions: [text] })).toMatchObject({ ok: false, reason: "duplicate" });
  });
});
