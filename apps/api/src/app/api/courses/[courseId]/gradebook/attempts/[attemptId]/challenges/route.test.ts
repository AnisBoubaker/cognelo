import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createGradeChallenge: vi.fn(),
  getServerEnv: vi.fn(),
  readJson: vi.fn(),
  requireUser: vi.fn()
}));

vi.mock("@cognelo/config", () => ({ getServerEnv: mocks.getServerEnv }));
vi.mock("@cognelo/core", () => ({
  createGradeChallenge: mocks.createGradeChallenge,
  listAttemptGradeChallenges: vi.fn()
}));
vi.mock("@/lib/http", () => ({
  handleRoute: async (handler: () => Promise<Response>) => handler(),
  json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  options: () => new Response(null, { status: 204 }),
  readJson: mocks.readJson,
  requireUser: mocks.requireUser
}));

const { POST } = await import("./route");

describe("grade challenge submission route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "student-1", roles: ["student"] });
    mocks.readJson.mockResolvedValue({
      feedbackRef: "grade:grade-1",
      feedbackVersion: 1,
      explanation: "I would like the released final grade to be reviewed."
    });
    mocks.getServerEnv.mockReturnValue({ EMAIL_CREDENTIALS_ENCRYPTION_KEY: "22".repeat(32) });
    mocks.createGradeChallenge.mockResolvedValue({ id: "challenge-1", status: "open" });
  });

  it("passes the email encryption key to teacher notification delivery", async () => {
    const response = await POST(
      new Request("http://localhost/api/courses/course-1/gradebook/attempts/attempt-1/challenges", { method: "POST" }) as never,
      { params: Promise.resolve({ courseId: "course-1", attemptId: "attempt-1" }) }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ challenge: { id: "challenge-1", status: "open" } });
    expect(mocks.createGradeChallenge).toHaveBeenCalledWith(
      { id: "student-1", roles: ["student"] },
      "course-1",
      "attempt-1",
      {
        feedbackRef: "grade:grade-1",
        feedbackVersion: 1,
        explanation: "I would like the released final grade to be reviewed."
      },
      "22".repeat(32)
    );
  });
});
