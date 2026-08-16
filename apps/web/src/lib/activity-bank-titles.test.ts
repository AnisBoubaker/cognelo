import { describe, expect, it } from "vitest";
import { defaultDuplicateBankActivityTitle } from "./activity-bank-titles";

describe("defaultDuplicateBankActivityTitle", () => {
  it("adds and increments the copy suffix", () => {
    expect(defaultDuplicateBankActivityTitle("Loops")).toBe("Loops (copy)");
    expect(defaultDuplicateBankActivityTitle("Loops (copy)")).toBe("Loops (copy #2)");
    expect(defaultDuplicateBankActivityTitle("Loops (copy #2)")).toBe("Loops (copy #3)");
  });

  it("does not reinterpret copy text that is not the final suffix", () => {
    expect(defaultDuplicateBankActivityTitle("Copy editing exercise")).toBe("Copy editing exercise (copy)");
  });

  it("keeps the suggested title within the activity title limit", () => {
    expect(defaultDuplicateBankActivityTitle("A".repeat(160))).toHaveLength(160);
  });
});
