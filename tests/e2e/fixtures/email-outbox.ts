import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { getMockEmailOutboxDirectory, type CapturedEmail } from "../../../packages/core/src/email-outbox";

export async function capturedEmailsFor(recipientEmail: string): Promise<CapturedEmail[]> {
  const directory = getMockEmailOutboxDirectory();
  const files = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const messages = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) =>
    JSON.parse(await readFile(path.join(directory, file), "utf8")) as CapturedEmail
  ));
  return messages.filter((message) => message.recipientEmail === recipientEmail.toLowerCase());
}

/** Only remove messages addressed to the calling test's unique recipient. */
export async function removeCapturedEmailsFor(recipientEmail: string) {
  const messages = await capturedEmailsFor(recipientEmail);
  await Promise.all(messages.map((message) => rm(path.join(getMockEmailOutboxDirectory(), `${message.id}.json`), { force: true })));
}
