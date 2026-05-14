import { describe, expect, it } from "vitest";
import { BankActivityDeleteSchema } from "./index";

describe("BankActivityDeleteSchema", () => {
  it("defaults force to false", () => {
    expect(BankActivityDeleteSchema.parse({})).toEqual({ force: false });
  });

  it("accepts an explicit forced delete confirmation", () => {
    expect(BankActivityDeleteSchema.parse({ force: true })).toEqual({ force: true });
  });
});
