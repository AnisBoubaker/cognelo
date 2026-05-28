import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  codingHomeworkGraderPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.codingHomeworkGraderPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.codingHomeworkGraderPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
