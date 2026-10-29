import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), user: vi.fn(), read: vi.fn() }));
vi.mock("@cognelo/core", () => ({ getTestAttemptTeacherReview: mocks.get, saveTestAttemptTeacherReview: mocks.save }));
vi.mock("@/lib/http", () => ({ handleRoute: (handler: () => unknown) => handler(), json: (value: unknown) => Response.json(value),
  requireUser: mocks.user, readJson: mocks.read, options: () => new Response(null, { status: 204 }) }));
const { GET, PATCH } = await import("./route");
const params = { params: Promise.resolve({ courseId: "course", attemptId: "attempt" }) };
const request = {} as NextRequest;
const input = { expectedUpdatedAt: "2026-10-28T12:00:00.000Z", expectedGradeUpdatedAt: null,
  items: [{ testItemId: "one", expectedUpdatedAt: "2026-10-28T12:00:00.000Z", expectedFeedbackHash: "hash", score: 5 }] };

describe("whole-Test review route", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "teacher" }); mocks.get.mockResolvedValue({ id: "attempt", gradeUpdatedAt: null }); mocks.save.mockResolvedValue({ review: { id: "attempt" } }); });
  it("loads the versioned review and submits one batch to the authorized core service", async () => {
    expect(await (await GET(request, params)).json()).toEqual({ review: { id: "attempt", gradeUpdatedAt: null } });
    mocks.read.mockResolvedValue(input);
    expect(await (await PATCH(request, params)).json()).toEqual({ review: { id: "attempt" } });
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ id: "teacher" }, "course", "attempt", input);
  });
  it.each([
    { ...input, expectedUpdatedAt: undefined },
    { ...input, expectedGradeUpdatedAt: undefined },
    { ...input, items: [input.items[0], input.items[0]] },
    { ...input, items: [] },
    { ...input, total: { mode: "override", score: -1 } },
    { ...input, total: { mode: "calculated", score: 4 } }
  ])("rejects malformed or ambiguous batches before mutation", async body => {
    mocks.read.mockResolvedValue(body);
    await expect(PATCH(request, params)).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("requires authentication before reading or writing", async () => {
    mocks.user.mockRejectedValue(new Error("Unauthorized"));
    await expect(GET(request, params)).rejects.toThrow("Unauthorized");
    await expect(PATCH(request, params)).rejects.toThrow("Unauthorized");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
