import type { SystemErrorCode } from "@cognelo/contracts";

/** Recognize Prisma errors across core and plugin client module graphs.
 * Inspect metadata/message only to classify; never return the exception text. */
export function classifySystemError(error: unknown): SystemErrorCode {
  if (!error || typeof error !== "object") return "SYS-001";
  const failure = error as { name?: unknown; code?: unknown; errorCode?: unknown; message?: unknown };
  if (typeof failure.name !== "string" || !failure.name.startsWith("PrismaClient")) return "SYS-001";
  const code = failure.errorCode ?? failure.code;
  if (["P1001", "P1002", "P1017"].includes(String(code))) return "SYS-002";
  if (["P1000", "P1003", "P1010", "P1011", "P1012", "P1013"].includes(String(code))) return "SYS-003";
  if (["P2021", "P2022"].includes(String(code))) return "SYS-004";
  if (["P1008", "P2024", "P2037"].includes(String(code))) return "SYS-005";
  // Some initialization failures omit errorCode, including the local DB outage.
  if (failure.name === "PrismaClientInitializationError" && typeof failure.message === "string") {
    if (/can't reach database server|connection (?:was )?closed/i.test(failure.message)) return "SYS-002";
    if (/authentication failed|access denied|database .* does not exist|invalid (?:database|connection) (?:url|string)/i.test(failure.message)) return "SYS-003";
  }
  return "SYS-001";
}
