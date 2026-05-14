import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  codingExercisesPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.codingExercisesPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.codingExercisesPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
