import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn(),
  resolveGradeChallenge: vi.fn()
}));

vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@cognelo/core", () => ({ resolveGradeChallenge: mocks.resolveGradeChallenge }));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { PATCH } = await import("./route");

describe("grade challenge response route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "teacher-1", roles: ["teacher"] });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "33".repeat(32) });
    mocks.readJson.mockResolvedValue({ teacherResponse: "I reviewed your work.", notifyStudent: true });
    mocks.resolveGradeChallenge.mockResolvedValue({ id: "challenge-1", status: "upheld" });
  });

  it("passes the email encryption key to challenge resolution", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/courses/course-1/grade-challenges/challenge-1", { method: "PATCH" }) as never,
      { params: Promise.resolve({ courseId: "course-1", challengeId: "challenge-1" }) }
    );

    await expect(response.json()).resolves.toEqual({ challenge: { id: "challenge-1", status: "upheld" } });
    expect(mocks.resolveGradeChallenge).toHaveBeenCalledWith(
      { id: "teacher-1", roles: ["teacher"] },
      "course-1",
      "challenge-1",
      { teacherResponse: "I reviewed your work.", notifyStudent: true },
      "33".repeat(32)
    );
  });
});
