vi.mock("./ai-http", () => ({ fetchAiResponse: (url: string, init: RequestInit) => fetch(url, { ...init, method: "POST" }) }));
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
  courseGroupParticipant: {
    findFirst: vi.fn()
  },
  courseMembership: {
    findFirst: vi.fn(),
    findMany: vi.fn()
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
  getCourseTeacherQuestionAuthoringAiAgentConnection,
  getCourseStudentSupportAiAgentConnection,
  getCourseAssessmentFeedbackAiAgentConnection,
  getAiAgentConnectionForUser,
  getCourseAiAgentConnection,
  selectAiAgentModel,
  snapshotAiModelSelection,
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
    mockPrisma.courseGroupParticipant.findFirst.mockResolvedValue({ id: "participant-1" });
    mockPrisma.courseMembership.findMany.mockResolvedValue([]);
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
    ).resolves.toEqual({ questionAuthoringAiAgentConnectionId: connectionId, questionAuthoringModel: null });

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

  it("gets a course teacher question-authoring connection for student-triggered course work", async () => {
    mockPrisma.course.findUnique.mockResolvedValue({
      createdById: "teacher-1",
      memberships: [
        {
          role: "teacher",
          userId: "teacher-1",
          user: { metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId } } }
        }
      ]
    });
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({
      id: "teacher-agent",
      ownerId: "teacher-1",
      provider: "openai",
      apiKey: "secret"
    });

    await expect(getCourseTeacherQuestionAuthoringAiAgentConnection({ ...teacherUser, id: "student-1", roles: ["student"] }, "course-1")).resolves.toMatchObject({
      id: "teacher-agent"
    });
    expect(mockPrisma.aiAgentConnection.findFirst).toHaveBeenCalledWith({
      where: {
        id: connectionId,
        isEnabled: true,
        OR: [{ ownerId: "teacher-1" }, { ownerId: null }]
      }
    });
  });

  it("falls back deterministically when higher-priority course staff have no usable connection", async () => {
    const fallbackConnectionId = "cly0000000000000000000000";
    mockPrisma.course.findUnique.mockResolvedValue({
      createdById: "teacher-1",
      memberships: [
        {
          role: "teacher",
          userId: "teacher-2",
          user: { metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: fallbackConnectionId } } }
        },
        {
          role: "owner",
          userId: "teacher-1",
          user: { metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId } } }
        }
      ]
    });
    mockPrisma.aiAgentConnection.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: fallbackConnectionId,
        ownerId: "teacher-2",
        provider: "ollama",
        apiKey: null
      });

    await expect(getCourseTeacherQuestionAuthoringAiAgentConnection(
      { ...teacherUser, id: "student-1", roles: ["student"] },
      "course-1"
    )).resolves.toMatchObject({ id: fallbackConnectionId });
    expect(mockPrisma.aiAgentConnection.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: connectionId,
        isEnabled: true,
        OR: [{ ownerId: "teacher-1" }, { ownerId: null }]
      }
    });
    expect(mockPrisma.aiAgentConnection.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: fallbackConnectionId,
        isEnabled: true,
        OR: [{ ownerId: "teacher-2" }, { ownerId: null }]
      }
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
      status: 502,
      code: "AI_AGENT_REQUEST_FAILED"
    });

    fetchMock.mockRestore();
  });
});

const catalogConnection = {
  id: connectionId, ownerId: "teacher-1", displayName: "Shared credential", provider: "codex" as const,
  model: "default-text", models: [{ model: "default-text", purpose: "generation" }, { model: "alternate-text", purpose: "generation" }, { model: "vector-model", purpose: "embedding" }],
  apiKey: "synthetic-secret", baseUrl: "https://provider.example/v1", isEnabled: true,
  createdAt: new Date(), updatedAt: new Date()
};

describe("reusable AI model connections", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("preserves legacy generation defaults and implicit compatible embeddings", () => {
    const legacy = { ...catalogConnection, models: [] };
    expect(selectAiAgentModel(legacy, "generation").model).toBe("default-text");
    expect(selectAiAgentModel(legacy, "embedding").model).toBe("text-embedding-3-small");
    expect(selectAiAgentModel(catalogConnection, "generation", "alternate-text")).toMatchObject({ id: connectionId, apiKey: "synthetic-secret", model: "alternate-text" });
    expect(catalogConnection.model).toBe("default-text");
    expect(() => selectAiAgentModel(catalogConnection, "generation", "vector-model")).toThrow();
    expect(() => selectAiAgentModel(catalogConnection, "embedding", "not-configured")).toThrow();
    expect(() => selectAiAgentModel({ ...catalogConnection, provider: "claude" }, "embedding")).toThrow();
  });
  it("edits the catalogue without rewriting or exposing the stored credential", async () => {
    mockPrisma.aiAgentConnection.findUnique.mockResolvedValue(catalogConnection);
    mockPrisma.aiAgentConnection.update.mockImplementation(async ({ data }) => ({ ...catalogConnection, ...data }));
    const result = await updateAiAgentConnection(teacherUser, connectionId, { models: [...catalogConnection.models, { model: "third-text", purpose: "generation" }] });
    expect(mockPrisma.aiAgentConnection.update.mock.calls[0][0].data).not.toHaveProperty("apiKey");
    expect(result.models).toContainEqual({ model: "third-text", purpose: "generation" });
    expect(result).toHaveProperty("hasApiKey", true);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
    expect(result).not.toHaveProperty("apiKey");
  });
  it("uses the account override for all shared authoring consumers and preserves it on legacy updates", async () => {
    const metadata = { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId, questionAuthoringModel: "alternate-text" } };
    mockPrisma.user.findUnique.mockResolvedValue({ metadata });
    mockPrisma.user.update.mockImplementation(async ({ data }) => data);
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue(catalogConnection);
    expect((await getQuestionAuthoringAiAgentConnection(teacherUser)).model).toBe("alternate-text");
    expect(await updateAiAgentPreferences(teacherUser, { questionAuthoringAiAgentConnectionId: connectionId })).toMatchObject(metadata.aiPreferences);
    await expect(updateAiAgentPreferences(teacherUser, { questionAuthoringModel: "vector-model" })).rejects.toMatchObject({ code: "AI_MODEL_NOT_CONFIGURED" });
    expect(await updateAiAgentPreferences(teacherUser, { questionAuthoringAiAgentConnectionId: null })).toEqual({ questionAuthoringAiAgentConnectionId: null, questionAuthoringModel: null });
  });
  it("resolves course support, assessment feedback, and teacher authoring overrides independently", async () => {
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue(catalogConnection);
    mockPrisma.course.findUnique.mockResolvedValue({ metadata: { aiSettings: {
      studentSupportAiAgentConnectionId: connectionId, studentSupportAiAgentModel: "alternate-text",
      automaticFeedbackEnabled: true, assessmentFeedbackAiAgentConnectionId: connectionId, assessmentFeedbackAiAgentModel: "default-text"
    } }, createdById: teacherUser.id, memberships: [{ userId: teacherUser.id, role: "owner", user: { metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId, questionAuthoringModel: "alternate-text" } } } }] });
    expect((await getCourseStudentSupportAiAgentConnection(adminUser, "course-1")).model).toBe("alternate-text");
    expect((await getCourseAssessmentFeedbackAiAgentConnection(adminUser, "course-1")).model).toBe("default-text");
    expect((await getCourseTeacherQuestionAuthoringAiAgentConnection(adminUser, "course-1")).model).toBe("alternate-text");
  });
  it("rejects private selections without an owner grant and rejects changed endpoints for frozen work", async () => {
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue(null);
    await expect(getAiAgentConnectionForUser(teacherUser, { connectionId, model: "alternate-text" }, "generation")).rejects.toMatchObject({ code: "AI_CONNECTION_UNAVAILABLE" });
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue(catalogConnection);
    mockPrisma.user.findUnique.mockResolvedValue({ isActive: true, roles: [{ role: { key: "teacher" } }] });
    const pinned = snapshotAiModelSelection({ ...catalogConnection, model: "alternate-text" });
    await expect(getCourseAiAgentConnection(adminUser, "course-1", pinned, "generation")).rejects.toMatchObject({ code: "AI_CONNECTION_UNAVAILABLE" });
    mockPrisma.courseMembership.findFirst.mockResolvedValue({ id: "membership" });
    expect((await getCourseAiAgentConnection(adminUser, "course-1", pinned, "generation")).model).toBe("alternate-text");
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({ ...catalogConnection, baseUrl: "https://changed.example/v1" });
    await expect(getCourseAiAgentConnection(adminUser, "course-1", pinned, "generation", true)).rejects.toMatchObject({ code: "AI_CONNECTION_CHANGED" });
  });
  it.each(["openai", "codex", "claude", "ollama"] as const)("sends the selected model and same credential through %s text transport", async provider => {
    mockPrisma.user.findUnique.mockResolvedValue({ metadata: { aiPreferences: { questionAuthoringAiAgentConnectionId: connectionId, questionAuthoringModel: "alternate-text" } }, isActive: false });
    mockPrisma.aiAgentConnection.findFirst.mockResolvedValue({ ...catalogConnection, provider });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ output_text: "answer", content: [{ text: "answer" }], message: { content: "answer" } }));
    try {
      expect(await generateQuestionAuthoringText(teacherUser, { systemPrompt: "system", userPrompt: "prompt" })).toBe("answer");
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url).endsWith(provider === "claude" ? "/messages" : provider === "ollama" ? "/api/chat" : "/responses")).toBe(true);
      expect(JSON.parse(String(init?.body)).model).toBe("alternate-text");
      expect(new Headers(init?.headers).get(provider === "claude" ? "x-api-key" : "authorization")).toBe(provider === "claude" ? "synthetic-secret" : "Bearer synthetic-secret");
    } finally { fetchMock.mockRestore(); }
  });
});
