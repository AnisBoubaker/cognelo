import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  codingHomeworkGraderPrisma?: PrismaClient;
};

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

export const prisma =
  globalForPrisma.codingHomeworkGraderPrisma ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.codingHomeworkGraderPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
