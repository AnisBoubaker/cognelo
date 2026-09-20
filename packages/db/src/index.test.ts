import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

type PrismaGlobalCache = typeof globalThis & {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

const prismaGlobalCache = globalThis as PrismaGlobalCache;
const clients = new Set<PrismaClient>();

afterEach(async () => {
  delete prismaGlobalCache.prisma;
  delete prismaGlobalCache.prismaSchemaSignature;
  await Promise.all([...clients].map((client) => client.$disconnect()));
  clients.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("shared Prisma client", () => {
  it("reuses only a client cached for the current generated schema", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const firstModule = await import("./index");
    clients.add(firstModule.prisma);

    vi.resetModules();
    const matchingModule = await import("./index");
    clients.add(matchingModule.prisma);
    expect(matchingModule.prisma).toBe(firstModule.prisma);

    prismaGlobalCache.prismaSchemaSignature = "stale-generated-client";
    vi.resetModules();
    const refreshedModule = await import("./index");
    clients.add(refreshedModule.prisma);
    expect(refreshedModule.prisma).not.toBe(firstModule.prisma);
  });
});
