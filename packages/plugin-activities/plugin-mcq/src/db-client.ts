import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  mcqPrisma?: PrismaClient;
};

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

export const prisma =
  globalForPrisma.mcqPrisma ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.mcqPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
export type { PluginMcqAiEvaluation } from "./generated/prisma";
