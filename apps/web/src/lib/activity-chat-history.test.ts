import { describe, expect, it } from "vitest";
import { applyChatDeletion, mergeChatMessages } from "./activity-chat-history";

const first = { id: "first", createdAt: "2026-10-23T12:00:00Z", body: "Original text", deletedAt: null as string | null, canDelete: true };
const latest = { ...first, id: "latest", createdAt: "2026-10-23T12:02:00Z" };
const deletedAt = "2026-10-23T12:03:00Z";

describe("retained chat deletion", () => {
  it("updates an older loaded message even when it is outside the refreshed history page", () => {
    const result = mergeChatMessages([first, latest], [latest], [{ id: first.id, deletedAt }]);
    expect(result[0]).toMatchObject({ body: "Original text", deletedAt, canDelete: false });
    expect(result[1].deletedAt).toBeNull();
  });
  it("cannot undo a successful deletion with an older in-flight response", () => {
    const result = mergeChatMessages([{ ...first, deletedAt, canDelete: false }], [first]);
    expect(result[0]).toMatchObject({ body: "Original text", deletedAt, canDelete: false });
  });
  it("marks all loaded copies of a deleted broadcast while retaining unrelated messages", () => {
    const messages = [{ ...first, broadcastId: "notice" }, { ...latest, broadcastId: "notice" }, { ...latest, id: "reply", broadcastId: null }];
    const result = applyChatDeletion(messages, { messageId: null, broadcastId: "notice", deletedAt });
    expect(result.map((message) => message.deletedAt)).toEqual([deletedAt, deletedAt, null]);
    expect(result.map((message) => message.body)).toEqual(messages.map((message) => message.body));
  });
});
