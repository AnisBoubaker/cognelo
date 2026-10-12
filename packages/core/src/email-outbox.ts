import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type MailMessage = {
  recipientEmail: string;
  subject: string;
  text: string;
  html: string;
};
export type CapturedEmail = MailMessage & { id: string; capturedAt: string };

/** Synthetic recipients must never reach an SMTP relay or Microsoft Graph. */
export function isMockEmailRecipient(email: string) {
  const domain = email.trim().toLowerCase().split("@").at(-1) ?? "";
  return ["cognelo.local", "example.com", "example.net", "example.org"].some((reserved) =>
    domain === reserved || domain.endsWith(`.${reserved}`)
  ) || ["test", "invalid", "example"].some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`));
}

export function getMockEmailOutboxDirectory() {
  const workingDirectory = process.cwd();
  const repositoryRoot = path.basename(workingDirectory) === "api" && path.basename(path.dirname(workingDirectory)) === "apps"
    ? path.resolve(workingDirectory, "../..")
    : workingDirectory;
  return path.join(repositoryRoot, "storage", "email-outbox");
}

/** Private filesystem capture, deliberately without an HTTP mailbox endpoint. */
export async function captureMockEmail(message: MailMessage, directory = getMockEmailOutboxDirectory()) {
  const captured: CapturedEmail = { ...message, id: randomUUID(), capturedAt: new Date().toISOString() };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(directory, `${captured.id}.tmp`);
  try {
    await writeFile(temporaryPath, JSON.stringify(captured, null, 2), { mode: 0o600, flag: "wx" });
    await rename(temporaryPath, path.join(directory, `${captured.id}.json`));
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
