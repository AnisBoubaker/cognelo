import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  webDesignCodingExercisesPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.webDesignCodingExercisesPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.webDesignCodingExercisesPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
