import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const uiRoots = ["apps", "packages"];
const sharedContextMenuPath = "packages/activity-ui/src/context-menu.tsx";

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : collectTsxFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("shared context menu usage", () => {
  it("does not allow page or plugin UI to render a raw action menu", () => {
    const violations = uiRoots.flatMap(collectTsxFiles).filter((path) => {
      if (path === sharedContextMenuPath) return false;
      const source = readFileSync(path, "utf8");
      return source.includes('role="menu"') || (source.includes('aria-haspopup="menu"') && !source.includes("<ContextMenu"));
    });

    expect(violations, "Use ContextMenu from @cognelo/activity-ui for contextual action menus").toEqual([]);
  });
});
