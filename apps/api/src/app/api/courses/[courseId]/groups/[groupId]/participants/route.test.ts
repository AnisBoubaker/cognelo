import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addGroupParticipant: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  addGroupParticipant: mocks.addGroupParticipant
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("group participants route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.readJson.mockResolvedValue({ email: "student@example.test", role: "student" });
    mocks.addGroupParticipant.mockResolvedValue({ id: "participant-1" });
  });

  it("adds a participant to the selected group", async () => {
    const response = await POST(new Request("http://test.local") as never, {
      params: Promise.resolve({ courseId: "course-1", groupId: "group-1" })
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ participant: { id: "participant-1" } });
    expect(mocks.addGroupParticipant).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "group-1",
      { email: "student@example.test", role: "student" }
    );
  });
});
