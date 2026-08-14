import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@cognelo/config", () => ({
  getServerEnv: () => ({
    CORS_ORIGIN: "http://localhost:3000",
    JWT_SECRET: "test-secret"
  })
}));

const { AppError } = await import("@cognelo/core");
const { AUTH_COOKIE, handleRoute, json, options, readJson, validateCsrfOrigin } = await import("./http");

describe("API HTTP helpers", () => {
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
