import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createActivityBank: vi.fn(),
  listActivityBanks: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  createActivityBank: mocks.createActivityBank,
  listActivityBanks: mocks.listActivityBanks
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { GET, POST } = await import("./route");

describe("activity banks route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.listActivityBanks.mockResolvedValue([{ id: "bank-1" }]);
    mocks.readJson.mockResolvedValue({ subjectId: "subject-1", title: "Programming basics" });
    mocks.createActivityBank.mockResolvedValue({ id: "bank-1" });
  });

  it("lists banks filtered by subject id", async () => {
    const request = {
      nextUrl: new URL("http://test.local/api/activity-banks?subjectId=subject-1")
    };
    const response = await GET(request as never);

    await expect(response.json()).resolves.toEqual({ activityBanks: [{ id: "bank-1" }] });
    expect(mocks.listActivityBanks).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "subject-1");
  });

  it("creates activity banks from the request body", async () => {
    const response = await POST(new Request("http://test.local") as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ activityBank: { id: "bank-1" } });
    expect(mocks.createActivityBank).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      { subjectId: "subject-1", title: "Programming basics" }
    );
  });
});
