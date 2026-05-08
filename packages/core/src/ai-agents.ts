import {
  AiAgentConnectionInputSchema,
  AiAgentConnectionUpdateSchema,
  AiAgentPreferencesInputSchema,
  type AiAgentScope,
  type CurrentUser
} from "@cognelo/contracts";
import { Prisma, prisma } from "@cognelo/db";
import { forbidden, notFound } from "./errors";
import { isAdmin } from "./authorization";

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
