import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearActivityResponseDraft: vi.fn(),
  getActivityResponseDraft: vi.fn(),
  saveActivityResponseDraft: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  clearActivityResponseDraft: mocks.clearActivityResponseDraft,
  getActivityResponseDraft: mocks.getActivityResponseDraft,
  saveActivityResponseDraft: mocks.saveActivityResponseDraft
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { DELETE, GET, PUT } = await import("./route");
const params = {
  params: Promise.resolve({ courseId: "course-1", groupId: "group-1", activityId: "activity-1" })
};

describe("assigned activity response draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.getActivityResponseDraft.mockResolvedValue({ id: "draft-1", state: { answers: {} } });
    mocks.saveActivityResponseDraft.mockResolvedValue({ id: "draft-1", state: { answers: { q1: ["a"] } } });
    mocks.clearActivityResponseDraft.mockResolvedValue({ ok: true });
    mocks.readJson.mockResolvedValue({ state: { answers: { q1: ["a"] } } });
  });

  it("loads a student's persisted draft", async () => {
    const response = await GET(new Request("http://test.local") as never, params);

    await expect(response.json()).resolves.toEqual({ draft: { id: "draft-1", state: { answers: {} } } });
    expect(mocks.getActivityResponseDraft).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "activity-1"
    );
  });

  it("saves a validated object state", async () => {
    const request = new Request("http://test.local", { method: "PUT" });
    const response = await PUT(request as never, params);

    await expect(response.json()).resolves.toEqual({ draft: { id: "draft-1", state: { answers: { q1: ["a"] } } } });
    expect(mocks.saveActivityResponseDraft).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "activity-1",
      { answers: { q1: ["a"] } }
    );
  });

  it("clears the student's draft after final submission", async () => {
    const response = await DELETE(new Request("http://test.local", { method: "DELETE" }) as never, params);

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.clearActivityResponseDraft).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "group-1",
      "activity-1"
    );
  });
});
