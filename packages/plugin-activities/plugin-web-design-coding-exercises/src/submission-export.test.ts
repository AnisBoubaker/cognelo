import { beforeEach, expect, it, vi } from "vitest";
import type { SubmissionExportInput } from "@cognelo/activity-sdk/server";
const mocks = vi.hoisted(() => ({ submission: vi.fn(), screenshot: vi.fn() }));
vi.mock("./db-client", () => ({ prisma: { pluginWebDesignExerciseSubmission: { findFirst: mocks.submission } } }));
vi.mock("./tests", () => ({ getWebDesignExpectedResult: mocks.screenshot }));
import { exportWebDesignSubmission } from "./submission-export";
const input = { activity: { id: "activity", description: "{{ EXPECTED_RESULT }}", config: { prompt: "{{ EXPECTED_RESULT }}" } }, pluginAttemptRef: "submission", userId: "student", state: null, metadata: {}, feedback: {}, includePrompt: false, includeGrading: false, labels: { prompt: "Prompt", noAnswer: "No answer", unavailable: "Unavailable" } } as unknown as SubmissionExportInput;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.submission.mockResolvedValue({ files: [{ path: "index.html", starterCode: "<script>studentCode()</script>", language: "html" }], testResults: [] });
  mocks.screenshot.mockResolvedValue({ imageDataUrl: "data:image/png;base64,cGljdHVyZQ==" });
});
it("exports student HTML as code without loading prompt images when omitted", async () => {
  const content = await exportWebDesignSubmission(input);
  expect(content.answer).toMatchObject([{ kind: "code", text: "<script>studentCode()</script>" }]);
  expect(content.prompt).toEqual([]); expect(mocks.screenshot).not.toHaveBeenCalled();
});
it("uses the stored screenshot instead of leaving an expected-result token in the prompt", async () => {
  const content = await exportWebDesignSubmission({ ...input, includePrompt: true });
  expect(content.replaceDescription).toBe(true);
  expect(content.prompt).toMatchObject([{ text: "![Prompt](data:image/png;base64,cGljdHVyZQ==)" }]);
});
