import { describe, expect, it } from "vitest";
import { placeholderDatabaseModule } from "./db";
import { placeholderPlugin } from "./index";
import { placeholderServerPlugin } from "./server";

describe("placeholder plugin manifest", () => {
  it("declares dummy plugin tables and safe no-op server hooks", () => {
    expect(placeholderPlugin.key).toBe("placeholder");
    expect(placeholderDatabaseModule.tables.length).toBeGreaterThanOrEqual(2);
    expect(placeholderDatabaseModule.migrations?.[0]?.statements.join("\n")).toContain("CREATE TABLE");
    expect(placeholderServerPlugin.routes).toEqual([]);
  });
});
