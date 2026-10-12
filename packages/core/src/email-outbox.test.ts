import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { captureMockEmail, isMockEmailRecipient } from "./email-outbox";

describe("mock email outbox", () => {
  it.each(["seed@cognelo.local", "Seed@COGNELO.LOCAL", "user@sub.cognelo.local", "pending@example.test", "e2e@example.invalid", "test@example.com", "test@sub.example.org", "test@school.example"])("captures the synthetic recipient %s", (email) => {
    expect(isMockEmailRecipient(email)).toBe(true);
  });
  it.each(["cognelo.local@university.edu", "student@cognelo.local.university.edu", "student@notcognelo.local", "student@gmail.com"])("does not capture the real-domain recipient %s", (email) => {
    expect(isMockEmailRecipient(email)).toBe(false);
  });
  it("writes complete messages to separate private files", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "cognelo-email-"));
    const directory = path.join(parent, "outbox");
    const message = { recipientEmail: "student@cognelo.local", subject: "Verification", text: "Code: 123456", html: "<p>Code: 123456</p>" };
    try {
      await Promise.all([captureMockEmail(message, directory), captureMockEmail(message, directory)]);
      const files = await readdir(directory);
      expect(files).toHaveLength(2);
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      for (const file of files) {
        expect((await stat(path.join(directory, file))).mode & 0o777).toBe(0o600);
        expect(JSON.parse(await readFile(path.join(directory, file), "utf8"))).toEqual({ ...message, id: file.replace(/\.json$/, ""), capturedAt: expect.any(String) });
      }
    } finally { await rm(parent, { recursive: true, force: true }); }
  });
});
