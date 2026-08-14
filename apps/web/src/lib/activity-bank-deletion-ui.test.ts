import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("apps/web/src/app/activity-banks/[activityBankId]/page.tsx", "utf8");

describe("activity bank deletion UI", () => {
  it("keeps deletion discoverable and uses the shared impact dialog", () => {
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain("activityBankDetail.activityActions");
    expect(source).toContain("<ConfirmationDialog");
    expect(source).toContain("activityBankDetail.removeAndPreserveCopies");
    expect(source).not.toContain("window.confirm");
  });
});
