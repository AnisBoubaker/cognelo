import { afterEach, expect, it, vi } from "vitest";
import { decryptCredential, encryptCredential } from "./credentials";
afterEach(() => vi.unstubAllEnvs());
it("encrypts credentials with random authenticated envelopes and rejects modified ciphertext", () => {
  vi.stubEnv("EMAIL_CREDENTIALS_ENCRYPTION_KEY", "a1".repeat(32));
  const first = encryptCredential("synthetic-provider-secret")!;
  expect(first).not.toContain("synthetic-provider-secret");
  expect(first).not.toBe(encryptCredential("synthetic-provider-secret"));
  expect(decryptCredential(first)).toBe("synthetic-provider-secret");
  const pieces = first.split(":"); pieces[2] = "00".repeat(16);
  expect(() => decryptCredential(pieces.join(":"))).toThrow();
});
