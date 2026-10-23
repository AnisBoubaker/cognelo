import { describe, expect, it } from "vitest";
import { LearnerActivityMessageInputSchema, ActivityMessageDeletionInputSchema, ActivityBroadcastMessageInputSchema, CourseAllGroupsActivityAssignmentInputSchema } from "./index";

describe("ActivityBroadcastMessageInputSchema", () => {
  it("trims and accepts a bounded message", () => {
    expect(ActivityBroadcastMessageInputSchema.parse({ body: "  Check question 3.  " })).toEqual({
      body: "Check question 3."
    });
  });

  it("rejects empty and oversized messages", () => {
    expect(() => ActivityBroadcastMessageInputSchema.parse({ body: "   " })).toThrow();
    expect(() => ActivityBroadcastMessageInputSchema.parse({ body: "x".repeat(2001) })).toThrow();
  });
});

describe("activity two-way messaging setting", () => {
  it("is optional for older callers and accepts only booleans", () => {
    expect(CourseAllGroupsActivityAssignmentInputSchema.parse({}).twoWayMessagingEnabled).toBeUndefined();
    expect(CourseAllGroupsActivityAssignmentInputSchema.parse({ twoWayMessagingEnabled: true }).twoWayMessagingEnabled).toBe(true);
    expect(() => CourseAllGroupsActivityAssignmentInputSchema.parse({ twoWayMessagingEnabled: "true" })).toThrow();
  });
});

describe("message deletion targets", () => {
  it("accepts exactly one message or broadcast id", () => {
    expect(ActivityMessageDeletionInputSchema.parse({ messageId: "reply" })).toEqual({ messageId: "reply" });
    expect(ActivityMessageDeletionInputSchema.parse({ broadcastId: "broadcast" })).toEqual({ broadcastId: "broadcast" });
    for (const input of [{}, { messageId: "" }, { messageId: "reply", broadcastId: "broadcast" }, { messageId: "reply", senderUserId: "teacher" }]) {
      expect(ActivityMessageDeletionInputSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe("student Test message input", () => {
  it("accepts a scoped Test item or a legacy plain message", () => {
    expect(LearnerActivityMessageInputSchema.parse({ body: "Hello" })).toEqual({ body: "Hello" });
    expect(LearnerActivityMessageInputSchema.parse({ body: "Help", testItem: { parentAttemptId: "attempt", testItemId: "item" } }).testItem?.testItemId).toBe("item");
  });
  it("rejects incomplete context and client-provided exercise titles or positions", () => {
    for (const testItem of [{ testItemId: "item" }, { parentAttemptId: "attempt", testItemId: "item", title: "Forged title" }, { parentAttemptId: "attempt", testItemId: "item", exerciseNumber: 9 }]) {
      expect(LearnerActivityMessageInputSchema.safeParse({ body: "Help", testItem }).success).toBe(false);
    }
  });
});
