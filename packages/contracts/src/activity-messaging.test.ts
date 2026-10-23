import { describe, expect, it } from "vitest";
import { ActivityBroadcastMessageInputSchema, CourseAllGroupsActivityAssignmentInputSchema } from "./index";

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
