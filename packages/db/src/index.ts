import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { Prisma, PrismaClient } from "@prisma/client";
