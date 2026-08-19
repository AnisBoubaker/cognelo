import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verifyAuthToken: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-token" }) })
}));
vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({ CORS_ORIGIN: "http://localhost:3000", JWT_SECRET: "test-secret" })
}));
vi.mock("@cognelo/core", () => ({
  AppError: class AppError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
  verifyAuthToken: mocks.verifyAuthToken
}));

const { requireUser } = await import("./http");

describe("forced password-change authorization", () => {
  it("blocks ordinary authenticated routes while allowing the password-change flow", async () => {
    const user = { id: "user-1", roles: ["teacher"], mustChangePassword: true };
    mocks.verifyAuthToken.mockResolvedValue(user);

    await expect(requireUser()).rejects.toMatchObject({ status: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    await expect(requireUser({ allowPasswordChangeRequired: true })).resolves.toBe(user);
  });
});
