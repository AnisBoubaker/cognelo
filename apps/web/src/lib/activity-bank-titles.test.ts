import { describe, expect, it } from "vitest";
import {
  defaultDuplicateActivityTitle,
  defaultDuplicateBankActivityTitle,
  defaultVariationBankActivityTitle
} from "./activity-bank-titles";

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
    expect(defaultDuplicateActivityTitle("A".repeat(180))).toHaveLength(180);
  });
});

describe("defaultVariationBankActivityTitle", () => {
  it("uses the current interface language for the variation suffix", () => {
    expect(defaultVariationBankActivityTitle("Loops", "en")).toBe("Loops (variation)");
    expect(defaultVariationBankActivityTitle("Boucles", "fr")).toBe("Boucles (variante)");
    expect(defaultVariationBankActivityTitle("循环", "zh")).toBe("循环（变体）");
    expect(defaultVariationBankActivityTitle("الحلقات", "ar")).toBe("الحلقات (نسخة متنوعة)");
  });

  it("keeps the suggested title within the bank activity title limit", () => {
    expect(defaultVariationBankActivityTitle("A".repeat(160), "en")).toHaveLength(160);
  });
});
