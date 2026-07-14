import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  parsonsPrisma?: PrismaClient;
};

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

export const prisma =
  globalForPrisma.parsonsPrisma ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.parsonsPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
export type { PluginParsonsAttempt, PluginParsonsAttemptEvent } from "./generated/prisma";
