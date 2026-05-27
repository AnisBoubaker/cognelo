import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  parsonsPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.parsonsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.parsonsPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
export type { PluginParsonsAttempt, PluginParsonsAttemptEvent } from "./generated/prisma";
