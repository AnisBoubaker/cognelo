import { afterEach, expect, it, vi } from "vitest";
vi.mock("@cognelo/core", () => ({ consumeRateLimits: vi.fn(), clearRateLimit: vi.fn() }));
import { authenticationSource } from "./auth-rate-limit";
afterEach(() => vi.unstubAllEnvs());
it("ignores caller-controlled forwarding unless the trusted proxy is explicitly configured", () => {
  vi.stubEnv("AUTH_TRUST_PROXY", "false");
  const request = new Request("http://example.test", { headers: { "x-forwarded-for": "203.0.113.1", "x-cognelo-client-ip": "203.0.113.2" } });
  expect(authenticationSource(request)).toBe("shared");
  vi.stubEnv("AUTH_TRUST_PROXY", "true");
  expect(authenticationSource(request)).toBe("203.0.113.2");
  expect(authenticationSource(new Request("http://example.test", { headers: { "x-cognelo-client-ip": "invalid, list" } }))).toBe("shared");
});
