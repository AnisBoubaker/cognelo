import { Prisma, PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  codingHomeworkGraderPrisma?: PrismaClient;
  codingHomeworkSchemaSignature?: string;
};

const prismaLogLevels: NonNullable<ConstructorParameters<typeof PrismaClient>[0]>["log"] =
  process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error"];

const schemaSignature = JSON.stringify(Prisma.dmmf.datamodel);
export const prisma =
  (globalForPrisma.codingHomeworkSchemaSignature === schemaSignature ? globalForPrisma.codingHomeworkGraderPrisma : undefined) ??
  new PrismaClient({
    log: prismaLogLevels
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.codingHomeworkGraderPrisma = prisma;
  globalForPrisma.codingHomeworkSchemaSignature = schemaSignature;
}

export { Prisma, PrismaClient } from "./generated/prisma";
