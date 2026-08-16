import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ compare: vi.fn(), requireUser: vi.fn() }));
vi.mock("@cognelo/core", () => ({ compareBankActivityVersions: mocks.compare }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(), json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }), requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("activity version diff route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.compare.mockResolvedValue({ sections: [], changeCount: 0 });
  });

  it("compares the requested versions", async () => {
    const request = new Request("http://test.local/api?fromVersionId=version-1&toVersionId=version-2");
    Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
    const response = await GET(request as never, { params: Promise.resolve({ activityBankId: "bank-1", bankActivityId: "activity-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.compare).toHaveBeenCalledWith({ id: "teacher-1", roles: ["teacher"] }, "bank-1", "activity-1", "version-1", "version-2");
  });
});
