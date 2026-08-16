import { describe, expect, it } from "vitest";
import { ActivityBankDeleteSchema } from "./index";

describe("ActivityBankDeleteSchema", () => {
  it("requires a destination when activities are moved", () => {
    expect(() => ActivityBankDeleteSchema.parse({ action: "move" })).toThrow();
    expect(ActivityBankDeleteSchema.parse({ action: "move", targetActivityBankId: "bank-2" })).toMatchObject({
      action: "move",
      targetActivityBankId: "bank-2",
      force: false
    });
  });

  it("defaults destructive deletion to unconfirmed", () => {
    expect(ActivityBankDeleteSchema.parse({ action: "delete" })).toEqual({ action: "delete", force: false });
  });
});
