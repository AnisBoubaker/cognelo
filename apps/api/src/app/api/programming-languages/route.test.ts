import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCodingExerciseProgrammingLanguages: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/plugin-coding-exercises/server", () => ({
  listCodingExerciseProgrammingLanguages: mocks.listCodingExerciseProgrammingLanguages
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown) => Response.json(data),
  options: () => new Response(null, { status: 204 }),
  requireUser: mocks.requireUser
}));

const { GET } = await import("./route");

describe("programming languages route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1" });
    mocks.listCodingExerciseProgrammingLanguages.mockResolvedValue([
      { key: "cpp", label: "C++" },
      { key: "python", label: "Python 3" }
    ]);
  });

  it("returns the programming languages exposed by Judge0 to authenticated users", async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({
      languages: [
        { key: "cpp", label: "C++" },
        { key: "python", label: "Python 3" }
      ]
    });
    expect(mocks.requireUser).toHaveBeenCalledOnce();
  });
});
