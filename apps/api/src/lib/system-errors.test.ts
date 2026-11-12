import { describe, expect, it } from "vitest";
import { Prisma } from "@cognelo/db";
import { classifySystemError } from "./system-errors";

describe("system failure classification", () => {
  it.each([
    ["P1000", "SYS-003"], ["P1001", "SYS-002"], ["P1002", "SYS-002"],
    ["P1017", "SYS-002"], ["P2021", "SYS-004"], ["P2022", "SYS-004"],
    ["P2024", "SYS-005"], ["P2037", "SYS-005"]
  ])("classifies Prisma %s by metadata", (code, expected) => {
    const error = new Prisma.PrismaClientKnownRequestError("private database details", { code, clientVersion: "5.22.0" });
    expect(classifySystemError(error)).toBe(expected);
  });

  it("recognizes initialization failures without errorCode, but does not guess from unrelated messages", () => {
    expect(classifySystemError(new Prisma.PrismaClientInitializationError("Can't reach database server at private-db.example.test", "5.22.0"))).toBe("SYS-002");
    expect(classifySystemError(new Prisma.PrismaClientInitializationError("Authentication failed against database server", "5.22.0"))).toBe("SYS-003");
    expect(classifySystemError(new Error("Can't reach database server"))).toBe("SYS-001");
    expect(classifySystemError(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "5.22.0" }))).toBe("SYS-001");
  });
});
