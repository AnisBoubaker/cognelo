import { expect, it, vi } from "vitest";
import type { SubmissionExportInput } from "@cognelo/activity-sdk/server";
vi.mock("./db-client", () => ({ prisma: { pluginParsonsAttempt: { findFirst: vi.fn() } } }));
import { exportParsonsSubmission } from "./submission-export";
const base = { activity: { id: "activity", config: { stripIndentation: true } }, state: { blocks: [{ displayText: "return result", currentIndent: 2 }, { displayText: "print(result)", currentIndent: 0 }] }, includePrompt: false, includeGrading: false, labels: { noAnswer: "No answer" } } as unknown as SubmissionExportInput;
it("keeps submitted order and converts each indentation level to two spaces", async () => {
  expect((await exportParsonsSubmission(base)).answer).toMatchObject([{ text: "    return result\nprint(result)" }]);
});
it("does not double-indent a block whose original indentation is already visible", async () => {
  const result = await exportParsonsSubmission({ ...base, activity: { ...base.activity, config: { stripIndentation: false } }, state: { blocks: [{ displayText: "  return result", currentIndent: 1 }] } });
  expect(result.answer).toMatchObject([{ text: "  return result" }]);
});
