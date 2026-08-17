import { describe, expect, it } from "vitest";
import { calculateContextMenuPosition } from "./context-menu";

describe("context menu positioning", () => {
  it("aligns to the trigger end and opens below when space is available", () => {
    expect(calculateContextMenuPosition({
      anchorRect: { bottom: 120, left: 300, right: 340, top: 80 },
      menuHeight: 100,
      menuWidth: 160,
      viewportHeight: 600,
      viewportWidth: 800
    })).toEqual({ left: 180, top: 124 });
  });

  it("flips above and clamps within the viewport", () => {
    expect(calculateContextMenuPosition({
      anchorRect: { bottom: 590, left: 4, right: 44, top: 550 },
      menuHeight: 180,
      menuWidth: 200,
      viewportHeight: 600,
      viewportWidth: 800
    })).toEqual({ left: 8, top: 366 });
  });
});
