import { describe, expect, it } from "vitest";
import { orderedLiveTestItems } from "./test-item-order";

describe("shared active Test order", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "new" }];
  const manifest = { items: [{ testItemId: "removed" }, { testItemId: "b" }, { testItemId: "a" }] };
  it("retains teacher order when randomization is off", () => {
    expect(orderedLiveTestItems(items, { manifest }, { randomizeItems: false })).toEqual(items);
  });
  it("keeps shuffled surviving items in order and appends newly added exercises", () => {
    expect(orderedLiveTestItems(items, { manifest }, { randomizeItems: true }).map((item) => item.id)).toEqual(["b", "a", "new"]);
  });
  it("uses the saved submission order for a reopened attempt", () => {
    expect(orderedLiveTestItems(items, { manifest, submissionManifest: { items: [{ testItemId: "a" }, { testItemId: "b" }] } }, { randomizeItems: true })).toEqual(items);
  });
});
