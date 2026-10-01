import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync("packages/activity-ui/src/confirmation-dialog.tsx", "utf8");

describe("ConfirmationDialog focus lifecycle", () => {
  it("initializes focus only when the dialog open state changes", () => {
    expect(dialogSource).toContain("onCancelRef.current = onCancel");
    expect(dialogSource).toContain("isConfirmingRef.current = isConfirming");
    expect(dialogSource).toMatch(/useEffect\(\(\) => \{[\s\S]*?\}, \[open\]\);/);
  });

  it("preserves an autofocus field already focused inside the dialog", () => {
    expect(dialogSource).toContain("dialogRef.current?.contains(document.activeElement)");
  });
});
