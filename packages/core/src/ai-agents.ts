import {
  AiAgentConnectionInputSchema,
  AiAgentConnectionUpdateSchema,
  AiAgentPreferencesInputSchema,
  type AiAgentScope,
  type CurrentUser
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { AppError, forbidden, notFound } from "./errors";
import { assertCanViewCourse, isAdmin } from "./authorization";

export async function listAiAgentConnections(user: CurrentUser) {
  const [connections, userRecord] = await Promise.all([
    prisma.aiAgentConnection.findMany({
      where: {
        OR: [{ ownerId: user.id }, { ownerId: null }]
      },
      orderBy: [{ ownerId: "asc" }, { updatedAt: "desc" }]
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { metadata: true } })
  ]);

  return {
    connections: connections.map(toPublicAiAgentConnection),
    preferences: getAiPreferences(userRecord?.metadata)
  };
}

export async function createAiAgentConnection(user: CurrentUser, input: unknown) {
  const data = AiAgentConnectionInputSchema.parse(input);
  assertCanManageScope(user, data.scope);
  const connection = await prisma.aiAgentConnection.create({
    data: {
      ownerId: data.scope === "global" ? null : user.id,
      provider: data.provider,
      displayName: data.displayName,
      model: data.model,
      baseUrl: normalizeNullable(data.baseUrl),
      apiKey: normalizeNullable(data.apiKey),
      isEnabled: data.isEnabled
    }
  });

  return toPublicAiAgentConnection(connection);
}

export async function updateAiAgentConnection(user: CurrentUser, connectionId: string, input: unknown) {
  const existing = await getManageableConnection(user, connectionId);
  const data = AiAgentConnectionUpdateSchema.parse(input);
  const nextScope = data.scope ?? scopeForOwner(existing.ownerId);
  assertCanManageScope(user, nextScope);

  const updateData = {
    ...(data.provider ? { provider: data.provider } : {}),
    ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
    ...(data.model !== undefined ? { model: data.model } : {}),
    ...(data.baseUrl !== undefined ? { baseUrl: normalizeNullable(data.baseUrl) } : {}),
    ...(data.apiKey !== undefined ? { apiKey: normalizeNullable(data.apiKey) } : {}),
    ...(data.scope !== undefined ? { ownerId: data.scope === "global" ? null : user.id } : {}),
    ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {})
  };

  const connection = await prisma.aiAgentConnection.update({
    where: { id: connectionId },
    data: updateData
  });

  return toPublicAiAgentConnection(connection);
}

export async function deleteAiAgentConnection(user: CurrentUser, connectionId: string) {
  await getManageableConnection(user, connectionId);
  await prisma.aiAgentConnection.delete({ where: { id: connectionId } });
  return { ok: true as const };
}

export async function updateAiAgentPreferences(user: CurrentUser, input: unknown) {
  const data = AiAgentPreferencesInputSchema.parse(input);
  await assertAiAgentConnectionCanBeSelected(user, data.questionAuthoringAiAgentConnectionId);
  const userRecord = await prisma.user.findUnique({ where: { id: user.id }, select: { metadata: true } });
  const metadata = asMetadataRecord(userRecord?.metadata);
  const aiPreferences = asMetadataRecord(metadata.aiPreferences);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      metadata: {
        ...metadata,
        aiPreferences: {
          ...aiPreferences,
          questionAuthoringAiAgentConnectionId: data.questionAuthoringAiAgentConnectionId ?? null
        }
      }
    },
    select: { metadata: true }
  });

  return getAiPreferences(updatedUser.metadata);
}

export async function getQuestionAuthoringAiAgentConnection(user: CurrentUser) {
  const userRecord = await prisma.user.findUnique({ where: { id: user.id }, select: { metadata: true } });
  const preferences = getAiPreferences(userRecord?.metadata);
  if (!preferences.questionAuthoringAiAgentConnectionId) {
    throw new AppError(400, "AI_AGENT_NOT_CONFIGURED", "No AI agent is configured for question authoring.");
  }

  const connection = await prisma.aiAgentConnection.findFirst({
    where: {
      id: preferences.questionAuthoringAiAgentConnectionId,
      isEnabled: true,
      OR: [{ ownerId: user.id }, { ownerId: null }]
    }
  });

  if (!connection) {
    throw notFound("AI agent connection");
  }
  if (!connection.apiKey && connection.provider !== "ollama") {
    throw new AppError(400, "AI_AGENT_KEY_MISSING", "The selected AI agent connection does not have an API key.");
  }

  return connection;
}

export async function getCourseTeacherQuestionAuthoringAiAgentConnection(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      createdById: true,
      memberships: {
        where: {
          role: { in: ["owner", "teacher"] }
        },
        select: {
          role: true,
          userId: true,
          user: { select: { metadata: true } }
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!course) {
    throw notFound("Course");
  }

  const staffPreferences = course.memberships
    .sort((left, right) => staffPreferencePriority(left, right, course.createdById))
    .map((membership) => ({
      userId: membership.userId,
      preferences: getAiPreferences(membership.user.metadata)
    }))
    .find((entry) => entry.preferences.questionAuthoringAiAgentConnectionId);

  const connectionId = staffPreferences?.preferences.questionAuthoringAiAgentConnectionId ?? null;
  if (!connectionId || !staffPreferences) {
    throw new AppError(400, "AI_AGENT_NOT_CONFIGURED", "No course teacher AI agent is configured for question authoring.");
  }

  const connection = await prisma.aiAgentConnection.findFirst({
    where: {
      id: connectionId,
      isEnabled: true,
      OR: [{ ownerId: staffPreferences.userId }, { ownerId: null }]
    }
  });

  if (!connection) {
    throw notFound("AI agent connection");
  }
  if (!connection.apiKey && connection.provider !== "ollama") {
    throw new AppError(400, "AI_AGENT_KEY_MISSING", "The selected course teacher AI agent connection does not have an API key.");
  }

  return connection;
}

export async function getCourseStudentSupportAiAgentConnection(user: CurrentUser, courseId: string) {
  await assertCanViewCourse(user, courseId);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { metadata: true } });
  if (!course) {
    throw notFound("Course");
  }

  const metadata = asMetadataRecord(course.metadata);
  const aiSettings = asMetadataRecord(metadata.aiSettings);
  const connectionId = typeof aiSettings.studentSupportAiAgentConnectionId === "string" ? aiSettings.studentSupportAiAgentConnectionId : null;
  if (!connectionId) {
    throw new AppError(400, "AI_AGENT_NOT_CONFIGURED", "No AI agent is configured for this course.");
  }

  const connection = await prisma.aiAgentConnection.findFirst({
    where: {
      id: connectionId,
      isEnabled: true
    }
  });

  if (!connection) {
    throw notFound("AI agent connection");
  }
  if (!connection.apiKey && connection.provider !== "ollama") {
    throw new AppError(400, "AI_AGENT_KEY_MISSING", "The selected AI agent connection does not have an API key.");
  }

  return connection;
}

export async function generateQuestionAuthoringText(
  user: CurrentUser,
  input: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
  }
) {
  const connection = await getQuestionAuthoringAiAgentConnection(user);
  return generateAiAgentText(connection, input);
}

export async function generateAiAgentText(
  connection: {
    provider: "ollama" | "openai" | "codex" | "claude";
    model: string;
    baseUrl: string | null;
    apiKey: string | null;
  },
  input: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
  }
) {
  return callAiAgent(connection, input);
}

async function getManageableConnection(user: CurrentUser, connectionId: string) {
  const connection = await prisma.aiAgentConnection.findUnique({ where: { id: connectionId } });
  if (!connection) {
    throw notFound("AI agent connection");
  }
  if (connection.ownerId === null && !isAdmin(user)) {
    throw forbidden();
  }
  if (connection.ownerId !== null && connection.ownerId !== user.id && !isAdmin(user)) {
    throw forbidden();
  }
  return connection;
}

function assertCanManageScope(user: CurrentUser, scope: AiAgentScope) {
  if (scope === "global" && !isAdmin(user)) {
    throw forbidden();
  }
}

function scopeForOwner(ownerId: string | null): AiAgentScope {
  return ownerId === null ? "global" : "personal";
}

function staffPreferencePriority(
  left: { role: string; userId: string },
  right: { role: string; userId: string },
  createdById: string
) {
  const score = (membership: { role: string; userId: string }) => {
    if (membership.userId === createdById) {
      return 0;
    }
    if (membership.role === "owner") {
      return 1;
    }
    return 2;
  };
  return score(left) - score(right);
}

function normalizeNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function assertAiAgentConnectionCanBeSelected(user: CurrentUser, connectionId: string | null | undefined) {
  if (!connectionId) {
    return;
  }
  const connection = await prisma.aiAgentConnection.findFirst({
    where: {
      id: connectionId,
      isEnabled: true,
      OR: [{ ownerId: user.id }, { ownerId: null }]
    }
  });
  if (!connection) {
    throw notFound("AI agent connection");
  }
}

function getAiPreferences(metadata: Prisma.JsonValue | undefined) {
  const root = asMetadataRecord(metadata);
  const aiPreferences = asMetadataRecord(root.aiPreferences);
  return {
    questionAuthoringAiAgentConnectionId:
      typeof aiPreferences.questionAuthoringAiAgentConnectionId === "string" ? aiPreferences.questionAuthoringAiAgentConnectionId : null
  };
}

function asMetadataRecord(value: Prisma.JsonValue | undefined): Record<string, Prisma.JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, Prisma.JsonValue>;
}

function toPublicAiAgentConnection(connection: {
  id: string;
  ownerId: string | null;
  provider: "ollama" | "openai" | "codex" | "claude";
  displayName: string;
  model: string;
  baseUrl: string | null;
  apiKey: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    scope: scopeForOwner(connection.ownerId),
    provider: connection.provider,
    displayName: connection.displayName,
    model: connection.model,
    baseUrl: connection.baseUrl,
    hasApiKey: Boolean(connection.apiKey),
    isEnabled: connection.isEnabled,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString()
  };
}

async function callAiAgent(
  connection: {
    provider: "ollama" | "openai" | "codex" | "claude";
    model: string;
    baseUrl: string | null;
    apiKey: string | null;
  },
  input: {
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens?: number;
  }
) {
  if (connection.provider === "ollama") {
    return callOllama(connection, input);
  }
  if (connection.provider === "claude") {
    return callClaude(connection, input);
  }
  return callOpenAiCompatible(connection, input);
}

async function callOpenAiCompatible(
  connection: { model: string; baseUrl: string | null; apiKey: string | null },
  input: { systemPrompt: string; userPrompt: string; maxOutputTokens?: number }
) {
  const baseUrl = normalizeBaseUrl(connection.baseUrl ?? "https://api.openai.com/v1");
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${connection.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: connection.model,
      instructions: input.systemPrompt,
      input: input.userPrompt,
      max_output_tokens: input.maxOutputTokens ?? 4000
    })
  });
  const payload = await readAiResponse(response);
  return extractOpenAiText(payload);
}

async function callClaude(
  connection: { model: string; baseUrl: string | null; apiKey: string | null },
  input: { systemPrompt: string; userPrompt: string; maxOutputTokens?: number }
) {
  const baseUrl = normalizeBaseUrl(connection.baseUrl ?? "https://api.anthropic.com/v1");
  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": connection.apiKey ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: connection.model,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.userPrompt }],
      max_tokens: input.maxOutputTokens ?? 4000
    })
  });
  const payload = await readAiResponse(response);
  return extractClaudeText(payload);
}

async function callOllama(
  connection: { model: string; baseUrl: string | null },
  input: { systemPrompt: string; userPrompt: string }
) {
  const baseUrl = normalizeBaseUrl(connection.baseUrl ?? "http://localhost:11434");
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: connection.model,
      stream: false,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt }
      ]
    })
  });
  const payload = await readAiResponse(response);
  return extractOllamaText(payload);
}

async function readAiResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? JSON.stringify(payload.error) : response.statusText;
    throw new AppError(response.status, "AI_AGENT_REQUEST_FAILED", `The AI agent request failed: ${message}`);
  }
  return payload;
}

function extractOpenAiText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (isRecord(payload) && Array.isArray(payload.output)) {
    return payload.output
      .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}

function extractClaudeText(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    return "";
  }
  return payload.content.map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : "")).join("\n").trim();
}

function extractOllamaText(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.message) && typeof payload.message.content === "string") {
    return payload.message.content;
  }
  if (isRecord(payload) && typeof payload.response === "string") {
    return payload.response;
  }
  return "";
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
