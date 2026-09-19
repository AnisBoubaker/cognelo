import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

const prismaSchemaSignature = JSON.stringify(Prisma.dmmf.datamodel);

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

export const prisma =
  (globalForPrisma.prismaSchemaSignature === prismaSchemaSignature ? globalForPrisma.prisma : undefined) ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = prismaSchemaSignature;
}

export { Prisma, PrismaClient } from "@prisma/client";
