import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listActivityTypes: vi.fn(),
  listRegisteredActivityDefinitions: vi.fn()
}));

vi.mock("@cognelo/core", () => ({
  listActivityTypes: mocks.listActivityTypes,
  listRegisteredActivityDefinitions: mocks.listRegisteredActivityDefinitions
}));

vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 })
}));

const { GET } = await import("./route");

describe("activity types route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listActivityTypes.mockResolvedValue([{ key: "mcq" }]);
    mocks.listRegisteredActivityDefinitions.mockReturnValue([{ key: "mcq", name: "Multiple choice" }]);
  });

  it("lists persisted activity types with registered definitions", async () => {
    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      activityTypes: [{ key: "mcq" }],
      registeredDefinitions: [{ key: "mcq", name: "Multiple choice" }]
    });
  });
});
