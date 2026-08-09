import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn()
}));

vi.mock("@cognelo/db", () => ({
  prisma: { $queryRaw: mocks.queryRaw }
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 })
}));

const { GET } = await import("./route");

describe("health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("checks database connectivity", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });
});
