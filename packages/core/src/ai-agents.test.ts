import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  aiAgentConnection: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  course: {
    findUnique: vi.fn()
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  prisma: mockPrisma,
  Prisma: {}
}));

const {
  createAiAgentConnection,
  deleteAiAgentConnection,
  getCourseStudentSupportAiAgentConnection,
  generateQuestionAuthoringText,
  getQuestionAuthoringAiAgentConnection,
  listAiAgentConnections,
  updateAiAgentConnection,
  updateAiAgentPreferences
} = await import("./ai-agents");

const teacherUser = {
  id: "teacher-1",
  email: "teacher@example.test",
  name: null,
  firstName: null,
  lastName: null,
  roles: ["teacher" as const]
};

const adminUser = {
  ...teacherUser,
  id: "admin-1",
  email: "admin@example.test",
  roles: ["admin" as const]
};

const connectionId = "clx0000000000000000000000";

describe("AI agent services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents non-admin users from creating global connections", async () => {
    await expect(
      createAiAgentConnection(teacherUser, {
        displayName: "Shared OpenAI",
        provider: "openai",
        model: "gpt-4.1-mini",
        scope: "global"
      })
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(mockPrisma.aiAgentConnection.create).not.toHaveBeenCalled();
  });

  it("normalizes blank optional connection fields to null", async () => {
    mockPrisma.aiAgentConnection.create.mockResolvedValue({
      id: "agent-1",
      ownerId: "teacher-1",
      provider: "ollama",
      displayName: "Local",
      model: "llama3",
      baseUrl: null,
      apiKey: null,
      isEnabled: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    });

    await createAiAgentConnection(teacherUser, {
      displayName: "Local",
      provider: "ollama",
      model: "llama3",
      baseUrl: null,
      apiKey: "",
      scope: "personal"
    });

    expect(mockPrisma.aiAgentConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "teacher-1",
        baseUrl: null,
        apiKey: null
      })
    });
  });

  it("prevents users from editing another user's personal connection", async () => {
    mockPrisma.aiAgentConnection.findUnique.mockResolvedValue({
      id: "agent-1",
      ownerId: "other-user"
    });

    await expect(updateAiAgentConnection(teacherUser, "agent-1", { model: "new-model" })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN"
    });
  });

  it("lists visible connections with user preferences and public API-key flags", async () => {
    mockPrisma.aiAgentConnection.findMany.mockResolvedValue([
      {
        id: "agent-1",
        ownerId: "teacher-1",
        provider: "openai",
        displayName: "OpenAI",
        model: "gpt-4.1-mini",
        baseUrl: null,
        apiKey: "secret",
        isEnabled: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z")
      }
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId } }
    });

    await expect(listAiAgentConnections(teacherUser)).resolves.toMatchObject({
      connections: [{ id: "agent-1", scope: "personal", hasApiKey: true }],
      preferences: { questionAuthoringAiAgentConnectionId: connectionId }
    });
  });

  it("deletes manageable connections", async () => {
    mockPrisma.aiAgentConnection.findUnique.mockResolvedValue({ id: "agent-1", ownerId: "teacher-1" });

    await expect(deleteAiAgentConnection(teacherUser, "agent-1")).resolves.toEqual({ ok: true });
    expect(mockPrisma.aiAgentConnection.delete).toHaveBeenCalledWith({ where: { id: "agent-1" } });
  });

  it("updates preferences only when the selected connection is visible and enabled", async () => {
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({ id: "agent-1" });
    mockPrisma.user.findUnique.mockResolvedValue({ metadata: { theme: "quiet" } });
    mockPrisma.user.update.mockResolvedValue({
      metadata: { theme: "quiet", aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId } }
    });

    await expect(
      updateAiAgentPreferences(teacherUser, {
        questionAuthoringAiAgentConnectionId: connectionId
      })
    ).resolves.toEqual({ questionAuthoringAiAgentConnectionId: connectionId });

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue(null);
    await expect(
      updateAiAgentPreferences(teacherUser, {
        questionAuthoringAiAgentConnectionId: "clx1111111111111111111111"
      })
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("gets the configured question-authoring connection and requires keys for non-Ollama providers", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId } }
    });
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "agent-1",
      provider: "openai",
      apiKey: null
    });

    await expect(getQuestionAuthoringAiAgentConnection(teacherUser)).rejects.toMatchObject({
      status: 400,
      code: "AI_AGENT_KEY_MISSING"
    });

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "agent-ollama",
      provider: "ollama",
      apiKey: null
    });
    await expect(getQuestionAuthoringAiAgentConnection(teacherUser)).resolves.toMatchObject({ id: "agent-ollama" });
  });

  it("gets the configured course student-support connection for course-scoped AI work", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      metadata: { aiSettings: { studentSupportAiAgentConnectionId: connectionId } }
    });
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "course-agent",
      provider: "openai",
      apiKey: "secret"
    });

    await expect(getCourseStudentSupportAiAgentConnection(adminUser, "course-1")).resolves.toMatchObject({ id: "course-agent" });
    expect(mockPrisma.aiAgentConnection.findFirst).toHaveBeenCalledWith({
      where: {
        id: connectionId,
        isEnabled: true
      }
    });

    mockPrisma.course.findUnique.mockResolvedValue({ metadata: { aiSettings: {} } });
    await expect(getCourseStudentSupportAiAgentConnection(adminUser, "course-1")).rejects.toMatchObject({
      status: 400,
      code: "AI_AGENT_NOT_CONFIGURED"
    });
  });

  it("calls OpenAI-compatible, Claude, and Ollama providers and maps failed requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    mockPrisma.user.findUnique.mockResolvedValue({
      metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId } }
    });

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "agent-1",
      provider: "openai",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.test/v1/",
      apiKey: "key",
      isEnabled: true
    });
    fetchMock.mockResolvedValueOnce(Response.json({ output_text: "OpenAI text" }));
    await expect(generateQuestionAuthoringText(teacherUser, { systemPrompt: "sys", userPrompt: "user" })).resolves.toBe("OpenAI text");

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "agent-1",
      provider: "claude",
      model: "claude-3",
      baseUrl: "https://api.anthropic.test/v1",
      apiKey: "key",
      isEnabled: true
    });
    fetchMock.mockResolvedValueOnce(Response.json({ content: [{ text: "Claude text" }] }));
    await expect(generateQuestionAuthoringText(teacherUser, { systemPrompt: "sys", userPrompt: "user" })).resolves.toBe("Claude text");

    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "agent-1",
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://localhost:11434",
      apiKey: null,
      isEnabled: true
    });
    fetchMock.mockResolvedValueOnce(Response.json({ message: { content: "Ollama text" } }));
    await expect(generateQuestionAuthoringText(teacherUser, { systemPrompt: "sys", userPrompt: "user" })).resolves.toBe("Ollama text");

    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: "bad" } }, { status: 500 }));
    await expect(generateQuestionAuthoringText(teacherUser, { systemPrompt: "sys", userPrompt: "user" })).rejects.toMatchObject({
      status: 500,
      code: "AI_AGENT_REQUEST_FAILED"
    });

    fetchMock.mockRestore();
  });
});
