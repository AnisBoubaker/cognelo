import { describe, expect, it } from "vitest";
import { ActivityBroadcastMessageInputSchema } from "./index";

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
