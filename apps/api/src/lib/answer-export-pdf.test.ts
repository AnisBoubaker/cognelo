import { describe, expect, it } from "vitest";
import { answerExportHtml, answerExportFileName } from "./answer-export-pdf";
import { publicImageUrl } from "./answer-export-images";
import type { buildAnswerExport } from "@cognelo/core";
const data: Awaited<ReturnType<typeof buildAnswerExport>> = {
  activityTitle: "Exam", courseTitle: "Course", subjectTitle: "Subject", timeZone: "UTC", options: { participantIds: ["p"], attempts: "all", includePrompt: false, includeGrading: false, format: "pdf", locale: "en" },
  documents: [{ participantId: "p", name: "Student <script>bad()</script>", email: "s@example.org", groupTitle: "Section", attempts: [{ id: "a", number: 1, submittedAt: "2026-10-23T12:00:00Z", score: "85 / 100", sections: [{ title: "Code", prompt: [{ kind: "markdown", text: "SECRET PROMPT" }], answer: [{ kind: "code", text: '<script>answer();</script>\nreturn 1 < 2;' }], grading: [{ kind: "markdown", text: "PRIVATE RUBRIC" }] }] }] }]
};
describe("answer PDF content", () => {
  it("escapes submitted source and identity, and omits disabled prompts and grading", () => {
    const html = answerExportHtml(data, data.documents);
    expect(html).toContain("&lt;script&gt;answer();&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("SECRET PROMPT"); expect(html).not.toContain("PRIVATE RUBRIC"); expect(html).not.toContain("85 / 100");
  });
  it("includes requested prompts, rubric and scores with printable math and tables", () => {
    const html = answerExportHtml({ ...data, options: { ...data.options, includePrompt: true, includeGrading: true } }, data.documents);
    expect(html).toContain("SECRET PROMPT"); expect(html).toContain("PRIVATE RUBRIC"); expect(html).toContain("85 / 100");
  });
  it("makes filesystem-safe archive entries without losing accented names", () => {
    expect(answerExportFileName("../Élève/\\bad\r\nname")).not.toMatch(/[\/\\\r\n]/);
    expect(answerExportFileName("Élève")).toBe("Élève");
  });
  it.each(["http://127.0.0.1/a.png", "http://169.254.169.254/a.png", "http://10.1.1.1/a.png", "http://2130706433/a.png", "http://[::1]/a.png", "file:///tmp/image.png", "https://user:password@example.org/image.png", "http://192.168.10.1/image.png"])("rejects unsafe image source %s", (url) => {
    expect(() => publicImageUrl(url)).toThrow();
  });
});
