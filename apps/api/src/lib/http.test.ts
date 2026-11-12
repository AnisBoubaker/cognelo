import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@cognelo/db";
import { z } from "zod";

vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({
    CORS_ORIGIN: "http://localhost:3000",
    JWT_SECRET: "test-secret"
  })
}));

const { AppError } = await import("@cognelo/core");
const { AUTH_COOKIE, handleRoute, json, options, progressJson, readJson, validateCsrfOrigin } = await import("./http");
const { listActivityDefinitions } = await import("@cognelo/activity-sdk");
const { listServerActivityPlugins } = await import("@cognelo/activity-sdk/server");
const { listContentTypeDefinitions } = await import("@cognelo/content-type-sdk");
const { listServerContentTypePlugins } = await import("@cognelo/content-type-sdk/server");

describe("API HTTP helpers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns a database support code without private details in production and logs the same code", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const outage = new Prisma.PrismaClientInitializationError("Can't reach database server at private-db.example.test:5432", "5.22.0");
    const response = await handleRoute(async () => { throw outage; });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: {
      code: "INTERNAL_ERROR", systemCode: "SYS-002", message: "System error (SYS-002)."
    } });
    expect(log).toHaveBeenCalledWith("system_error", { systemCode: "SYS-002", code: "INTERNAL_ERROR" }, outage);
  });

  it("shows actionable development diagnostics without copying raw exceptions", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleRoute(async () => {
      throw new Prisma.PrismaClientInitializationError("Can't reach database server at private-db.example.test", "5.22.0", "P1001");
    });
    const body = await response.json();
    expect(body.error.message).toContain("Database unavailable");
    expect(body.error.message).toContain("docker compose up -d db");
    expect(JSON.stringify(body)).not.toContain("private-db.example.test");
  });

  it.each(["production", "test"])("keeps unexpected and declared 5xx error details server-side in %s", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [error, code, systemCode] of [
      [new Error("secret connection string"), "INTERNAL_ERROR", "SYS-001"],
      [new AppError(502, "PROVIDER_FAILED", "private provider response", { token: "secret" }), "PROVIDER_FAILED", "SYS-006"]
    ] as const) {
      const response = await handleRoute(async () => { throw error; });
      await expect(response.json()).resolves.toEqual({ error: { code, systemCode, message: `System error (${systemCode}).` } });
    }
  });

  it("preserves plugin file bytes, content headers and status while applying host response policy", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255]);
    const response = json(new Response(bytes, { status: 206, headers: {
      "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="assignment.pdf"',
      "Content-Length": String(bytes.length), "Content-Range": "bytes 0-10/11", "X-Content-Type-Options": "nosniff"
    } }));
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-10/11");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
  it("streams measured progress before the final result with CORS and no buffering", async () => {
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const response = progressJson<{ completed: number }>(async report => {
      report({ completed: 1 });
      await gate;
      return { result: "graded" };
    });
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"completed":1');
    finish();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"result":"graded"');
    expect((await reader.read()).done).toBe(true);
  });

  it("sanitizes unexpected streamed errors and finishes persistence after the reader disconnects", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failed = progressJson(async () => { throw new Error("private grading details"); });
      const body = await failed.text();
      expect(body).toContain("INTERNAL_ERROR");
      expect(body).not.toContain("private grading details");
      let finish!: () => void;
      const gate = new Promise<void>(resolve => { finish = resolve; });
      const persisted = vi.fn();
      const response = progressJson(async report => { await gate; report({ completed: 1 }); persisted(); return {}; });
      await response.body!.cancel();
      finish();
      await vi.waitFor(() => expect(persisted).toHaveBeenCalledOnce());
    } finally { log.mockRestore(); }
  });
  it("loads the installed plugin composition in the route-handler module graph", () => {
    expect(listActivityDefinitions().map((definition) => definition.key).sort()).toEqual([
      "coding-exercise",
      "coding-homework-grader",
      "mcq",
      "parsons-problem",
      "placeholder",
      "test",
      "web-design-coding-exercise"
    ]);
    expect(listServerActivityPlugins().map((plugin) => plugin.key).sort()).toEqual([
      "coding-exercises",
      "coding-homework-grader",
      "mcq",
      "parsons",
      "placeholder",
      "web-design-coding-exercises"
    ]);
    expect(listContentTypeDefinitions().map((definition) => definition.key).sort()).toEqual([
      "file",
      "github-repo",
      "link",
      "text"
    ]);
    expect(listServerContentTypePlugins().map((plugin) => plugin.key).sort()).toEqual([
      "file-content",
      "github-repo-content",
      "link-content",
      "text-content"
    ]);
  });

  it("rejects unsafe authenticated requests from missing or foreign origins", () => {
    const request = (method: string, origin?: string, authenticated = true) => ({
      method,
      headers: new Headers(origin ? { origin } : {}),
      cookies: { get: (name: string) => name === AUTH_COOKIE && authenticated ? { value: "session" } : undefined }
    });

    expect(validateCsrfOrigin(request("POST", "http://localhost:3000") as never, "http://localhost:3000")).toBe(true);
    expect(validateCsrfOrigin(request("POST", "https://attacker.test") as never, "http://localhost:3000")).toBe(false);
    expect(validateCsrfOrigin(request("DELETE") as never, "http://localhost:3000")).toBe(false);
    expect(validateCsrfOrigin(request("POST", undefined, false) as never, "http://localhost:3000")).toBe(true);
    expect(validateCsrfOrigin(request("GET", "https://attacker.test") as never, "http://localhost:3000")).toBe(true);
  });
  it("adds CORS and no-store headers to JSON responses", async () => {
    const response = json({ ok: true }, { status: 201 });

    expect(response.status).toBe(201);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns preflight responses with supported methods", () => {
    const response = options();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
  });

  it("maps validation and app errors into API error bodies", async () => {
    const validationResponse = await handleRoute(async () => {
      z.object({ title: z.string().min(2) }).parse({ title: "" });
      return json({});
    });

    expect(validationResponse.status).toBe(400);
    await expect(validationResponse.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed." }
    });

    const appResponse = await handleRoute(async () => {
      throw new AppError(403, "FORBIDDEN", "Nope.", { reason: "test" });
    });

    expect(appResponse.status).toBe(403);
    await expect(appResponse.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Nope.", details: { reason: "test" } }
    });
  });

  it("rejects invalid JSON bodies", async () => {
    const request = new Request("http://test.local", {
      method: "POST",
      body: "{"
    });

    await expect(readJson(request as never)).rejects.toMatchObject({ code: "INVALID_JSON", status: 400 });
  });
});
