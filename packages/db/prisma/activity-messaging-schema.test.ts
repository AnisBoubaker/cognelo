import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/202610110003_activity_attempt_messaging/migration.sql", import.meta.url),
  "utf8"
);

describe("activity attempt messaging schema", () => {
  it("keeps conversations attempt-scoped and ready for messages in either direction", () => {
    expect(schema).toContain("model ActivityConversation");
    expect(schema).toContain("attemptId       String?");
    expect(schema).toContain("attemptNumber   Int");
    expect(schema).toContain("model ActivityConversationMessage");
    expect(schema).toContain("senderKind");
    expect(schema).toContain("model ActivityConversationRead");
    expect(schema).toContain("@@unique([groupActivityId, participantId, attemptNumber])");
  });

  it("ships an additive migration for broadcasts, messages, and per-user reads", () => {
    expect(migration).toContain('CREATE TABLE "ActivityMessageBroadcast"');
    expect(migration).toContain('CREATE TABLE "ActivityConversation"');
    expect(migration).toContain('CREATE TABLE "ActivityConversationMessage"');
    expect(migration).toContain('CREATE TABLE "ActivityConversationRead"');
    expect(migration).toContain('CREATE UNIQUE INDEX "ActivityConversation_groupActivityId_participantId_attemptNumber_key"');
  });
});
