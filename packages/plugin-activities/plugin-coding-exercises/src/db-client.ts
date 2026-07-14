import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  codingExercisesPrisma?: PrismaClient;
};

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

export const prisma =
  globalForPrisma.codingExercisesPrisma ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.codingExercisesPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
