import { describe, expect, it } from "vitest";
import { homeworkRubricExportBlocks } from "./rubric-export";
import { calculateHomeworkFeedback, defaultHomeworkGrading, homeworkFeedbackDraft } from "./rubric";
import type { AnswerExportLabels } from "@cognelo/activity-sdk/server";
describe("homework grading exports", () => {
  it("exports reviewed component scores and question rubrics without private provenance", () => {
    const criterion = { id: "criterion", title: "Reasoning", description: "", weightPercent: 100 };
    const feedback = homeworkFeedbackDraft({ ...defaultHomeworkGrading(), enabled: true, code: { criteria: [criterion], instructions: "SECRET INSTRUCTIONS" }, questions: { criteria: [criterion], instructions: "SECRET QUESTION DIRECTIONS" } }, ["private-question-id"]);
    feedback.privateSharedCodeRevision = "PRIVATE HASH";
    feedback.code.criteria[0] = { ...feedback.code.criteria[0], scorePercent: 80, feedback: "Reviewed code comment" };
    feedback.questions[0].criteria[0] = { ...feedback.questions[0].criteria[0], scorePercent: 60, feedback: "Reviewed answer comment" };
    const labels = Object.fromEntries(["summary", "strengths", "improvements", "criterion", "weight", "score", "comments", "rubric", "file", "question", "grading", "unavailable"].map(key => [key, key])) as AnswerExportLabels;
    const output = JSON.stringify(homeworkRubricExportBlocks(calculateHomeworkFeedback(feedback), labels));
    expect(output).toContain("56 / 70"); expect(output).toContain("18 / 30");
    expect(output).toContain("Reviewed code comment"); expect(output).toContain("Reviewed answer comment");
    expect(output).not.toContain("SECRET"); expect(output).not.toContain("PRIVATE HASH"); expect(output).not.toContain("private-question-id");
  });
});
