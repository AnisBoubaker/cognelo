import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  executionRunner: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({ prisma: mockPrisma }));

const {
  listExecutionRunnerConfigurations,
  resolveExecutionRunner,
  testExecutionRunnerConnection,
  updateExecutionRunnerConfiguration
} = await import("./execution-runners");

const encryptionKey = "22".repeat(32);
const now = new Date("2026-09-29T12:00:00.000Z");
const admin = {
  id: "admin-1",
  email: "admin@example.test",
  name: null,
  firstName: "Admin",
  lastName: "User",
  roles: ["admin" as const]
};
const teacher = { ...admin, id: "teacher-1", roles: ["teacher" as const] };

describe("execution runner registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.executionRunner.findMany.mockResolvedValue([]);
    mockPrisma.executionRunner.findUnique.mockResolvedValue(null);
    mockPrisma.executionRunner.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      ...create,
      createdAt: now,
      updatedAt: now
    }));
  });

  it("keeps configuration admin-only and always lists all supported runner types", async () => {
    await expect(listExecutionRunnerConfigurations(teacher)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(listExecutionRunnerConfigurations(admin)).resolves.toEqual([
      expect.objectContaining({ configured: false, runnerType: "judge0" }),
      expect.objectContaining({ configured: false, runnerType: "web_design" }),
      expect.objectContaining({ configured: false, runnerType: "sagemath" })
    ]);
  });

  it("encrypts authentication tokens and exposes only a presence flag", async () => {
    const configuration = await updateExecutionRunnerConfiguration(admin, "judge0", {
      displayName: "Primary Judge0",
      baseUrl: "https://judge0.example.test/",
      authHeader: "X-Auth-Token",
      authToken: "runner-secret",
      isEnabled: true,
      settings: { enablePerProcessAndThreadLimits: false }
    }, encryptionKey);

    const create = mockPrisma.executionRunner.upsert.mock.calls[0][0].create;
    expect(create.authTokenEncrypted).not.toContain("runner-secret");
    expect(create.baseUrl).toBe("https://judge0.example.test");
    expect(configuration).toMatchObject({ configured: true, hasAuthToken: true });
    expect(configuration).not.toHaveProperty("authTokenEncrypted");
  });

  it("selects the first enabled runner and decrypts its request header", async () => {
    await updateExecutionRunnerConfiguration(admin, "judge0", {
      displayName: "Primary Judge0",
      baseUrl: "https://judge0.example.test",
      authHeader: "X-Auth-Token",
      authToken: "runner-secret",
      isEnabled: true
    }, encryptionKey);
    const stored = mockPrisma.executionRunner.upsert.mock.calls[0][0].create;
    mockPrisma.executionRunner.findFirst.mockResolvedValue({ ...stored, createdAt: now, updatedAt: now });

    await expect(resolveExecutionRunner("judge0", encryptionKey)).resolves.toMatchObject({
      baseUrl: "https://judge0.example.test",
      headers: { "X-Auth-Token": "runner-secret" }
    });
    expect(mockPrisma.executionRunner.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { runnerType: "judge0", isEnabled: true },
      orderBy: [{ position: "asc" }, { id: "asc" }]
    }));
  });

  it("tests Judge0 language discovery and an actual synchronous execution", async () => {
    mockPrisma.executionRunner.findUnique.mockResolvedValue({
      id: "execution-runner-judge0-primary",
      runnerType: "judge0",
      displayName: "Judge0",
      baseUrl: "https://judge0.example.test",
      authHeader: null,
      authTokenEncrypted: null,
      isEnabled: true,
      position: 0,
      settings: { enablePerProcessAndThreadLimits: true },
      createdAt: now,
      updatedAt: now
    });
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(Response.json([{ id: 50, name: "C (GCC 9.2.0)" }]))
      .mockResolvedValueOnce(Response.json({ token: "submission-1", status: { id: 3, description: "Accepted" } }));

    await expect(testExecutionRunnerConnection(admin, "judge0", encryptionKey, {
      fetch: fetchImplementation as typeof fetch
    })).resolves.toEqual({
      ok: true,
      capabilities: [
        expect.objectContaining({ key: "connection", ok: true }),
        expect.objectContaining({ key: "languages", ok: true }),
        expect.objectContaining({ key: "execute", ok: true })
      ]
    });
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      2,
      "https://judge0.example.test/submissions?base64_encoded=true&wait=true",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reports missing advertised capabilities from a health endpoint", async () => {
    mockPrisma.executionRunner.findUnique.mockResolvedValue({
      id: "execution-runner-sagemath-primary",
      runnerType: "sagemath",
      displayName: "SageMath",
      baseUrl: "https://sage.example.test",
      authHeader: null,
      authTokenEncrypted: null,
      isEnabled: false,
      position: 0,
      settings: {},
      createdAt: now,
      updatedAt: now
    });
    const result = await testExecutionRunnerConnection(admin, "sagemath", encryptionKey, {
      fetch: vi.fn().mockResolvedValue(Response.json({ ok: true, capabilities: ["sagemath"] })) as typeof fetch
    });
    expect(result.ok).toBe(false);
    expect(result.capabilities).toContainEqual(expect.objectContaining({ key: "execute", ok: false }));
  });
});
