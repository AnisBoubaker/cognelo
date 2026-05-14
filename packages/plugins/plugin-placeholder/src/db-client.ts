import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  placeholderPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.placeholderPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.placeholderPrisma = prisma;
}

export { Prisma, PrismaClient } from "./generated/prisma";
