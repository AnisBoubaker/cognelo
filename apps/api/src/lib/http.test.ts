import { describe, expect, it, vi } from "vitest";
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

  it("returns an empty object for invalid JSON bodies", async () => {
    const request = new Request("http://test.local", {
      method: "POST",
      body: "{"
    });

    await expect(readJson(request as never)).resolves.toEqual({});
  });
});
