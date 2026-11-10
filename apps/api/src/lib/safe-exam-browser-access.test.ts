import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@cognelo/contracts";
const mocks = vi.hoisted(() => ({ access: vi.fn(), verify: vi.fn(), token: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocks.token ? { value: mocks.token } : undefined }) }));
vi.mock("@cognelo/config", () => ({ getServerEnv: () => ({ JWT_SECRET: "a-long-enough-local-test-signing-secret" }) }));
vi.mock("@cognelo/core", async importOriginal => ({ ...await importOriginal<typeof import("@cognelo/core")>(), getGroupAssignedActivityAccess: mocks.access, verifySafeExamBrowserAccessToken: mocks.verify }));
import { requireSafeExamBrowserAccess } from "./safe-exam-browser";
const user = { id: "learner" } as CurrentUser;
const request = new Request("http://localhost/activity");
describe("stage-specific SEB guard", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.token = ""; });
  for (const files of [false, true]) for (const questions of [false, true]) it(`guards only configured stages: ${files}/${questions}`, async () => {
    mocks.access.mockResolvedValue({ requiresSafeExamBrowser: files || questions, assessmentRequiresSafeExamBrowser: questions, stageSafeExamBrowser: { files, questions }, preparationAllowed: true });
    for (const [submissionStageId, required] of [["files", files], ["questions", questions]] as const) {
      const guarded = requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { preparation: true, submissionStageId });
      if (required) await expect(guarded).rejects.toMatchObject({ code: "SAFE_EXAM_BROWSER_REQUIRED" }); else await expect(guarded).resolves.toBeDefined();
    }
    const answering = requireSafeExamBrowserAccess(request, user, "course", "section", "activity");
    if (questions) await expect(answering).rejects.toMatchObject({ code: "SAFE_EXAM_BROWSER_REQUIRED" }); else await expect(answering).resolves.toBeDefined();
    await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { preparation: true })).resolves.toBeDefined();
  });
  it("reuses the verified activity configuration for either stage and rejects foreign access", async () => {
    mocks.access.mockResolvedValue({ requiresSafeExamBrowser: true, assessmentRequiresSafeExamBrowser: true, stageSafeExamBrowser: { files: true, questions: true } });
    mocks.token = "verified-session";
    mocks.verify.mockResolvedValue({ userId: user.id, courseId: "course", groupId: "section", activityId: "activity" });
    for (const submissionStageId of ["files", "questions"]) await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { submissionStageId })).resolves.toBeDefined();
    mocks.verify.mockResolvedValue({ userId: "someone-else", courseId: "course", groupId: "section", activityId: "activity" });
    await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { submissionStageId: "files" })).rejects.toMatchObject({ code: "SAFE_EXAM_BROWSER_REQUIRED" });
    await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { submissionStageId: "invented" })).rejects.toMatchObject({ code: "SUBMISSION_STAGE_UNKNOWN" });
    await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { preparation: true, submissionStageId: "" })).rejects.toMatchObject({ code: "SUBMISSION_STAGE_UNKNOWN" });
  });
  it("retains ordinary activity requirements and teacher bypass", async () => {
    mocks.access.mockResolvedValue({ requiresSafeExamBrowser: true });
    await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "ordinary")).rejects.toMatchObject({ code: "SAFE_EXAM_BROWSER_REQUIRED" });
    mocks.access.mockResolvedValue({ requiresSafeExamBrowser: true, canBypass: true, stageSafeExamBrowser: { files: true } });
    await expect(requireSafeExamBrowserAccess(request, user, "course", "section", "activity", { submissionStageId: "files" })).resolves.toBeDefined();
  });
});
