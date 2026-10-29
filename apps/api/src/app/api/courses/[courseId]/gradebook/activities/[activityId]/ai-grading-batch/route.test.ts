import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn(), contexts: vi.fn(), context: vi.fn(), prepare: vi.fn(), manage: vi.fn(), batch: vi.fn() }));
vi.mock("@cognelo/core", () => ({
  AppError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  assertCanManageCourse: mocks.manage, getActivityAttemptRegradeContext: mocks.context,
  getActivityAttemptRegradeContexts: mocks.contexts, getTeacherAttemptAiFeedbackReview: vi.fn(), prepareTestAiGradingTemplates: mocks.prepare
}));
vi.mock("@cognelo/activity-sdk/server", () => ({ resolvePluginAiFeedbackTeacherReviewHandler: vi.fn(), resolvePluginAiGradingBatchHandler: mocks.batch }));
vi.mock("@/lib/http", () => ({ handleRoute: (handler: () => unknown) => handler(), json: (value: unknown) => Response.json(value),
  requireUser: mocks.user, readJson: mocks.read, options: () => new Response(null, { status: 204 }) }));
const { POST, PATCH } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course", activityId: "test" }) };
const request = {} as NextRequest;

describe("Test batch preparation", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "teacher" });
    mocks.contexts.mockResolvedValue([{ activityId: "test", activityTypeKey: "test" }]);
    mocks.context.mockResolvedValue({ activityId: "test", activityTypeKey: "test" });
    mocks.prepare.mockResolvedValue({ available: true, instructions: null, templates: [] });
  });
  it("offers template selection without manufacturing parent instructions", async () => {
    mocks.read.mockResolvedValue({ attemptIds: ["attempt"] });
    expect(await (await POST(request, params)).json()).toEqual({ available: true, instructions: null, templates: [] });
    expect(mocks.prepare).toHaveBeenCalledWith({ id: "teacher" }, "course", "test", ["attempt"]);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
  it("rejects attempts from another activity before preparing templates", async () => {
    mocks.read.mockResolvedValue({ attemptIds: ["attempt"] });
    mocks.contexts.mockResolvedValue([{ activityId: "other", activityTypeKey: "test" }]);
    await expect(POST(request, params)).rejects.toMatchObject({ code: "AI_BATCH_ATTEMPT_ACTIVITY_MISMATCH" });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("rejects a Test-wide instruction update", async () => {
    mocks.read.mockResolvedValue({ attemptId: "attempt", instructions: "Do not overwrite child policy" });
    await expect(PATCH(request, params)).rejects.toMatchObject({ code: "TEST_AI_INSTRUCTIONS_QUESTION_SPECIFIC" });
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
