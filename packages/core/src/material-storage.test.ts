import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openStoredMaterial } from "./material-storage";

describe("legacy material containment", () => {
  it("serves server filenames and rejects traversal, encoding, absolute paths and symlinks for both scopes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "cognelo-file-test-"));
    try {
      await mkdir(path.join(root, "course", "group"), { recursive: true });
      const name = `${randomUUID()}-safe.txt`;
      for (const scope of [["course"], ["course", "group"]]) {
        await writeFile(path.join(root, ...scope, name), "harmless");
        const file = await openStoredMaterial(root, scope, name);
        try { expect(await file.readFile("utf8")).toBe("harmless"); } finally { await file.close(); }
        for (const invalid of ["../outside", "/etc/hosts", "..\\outside", "%2e%2e%2foutside", `${name}/../other`, "plain.txt", `${name}%00`]) {
          await expect(openStoredMaterial(root, scope, invalid)).rejects.toMatchObject({ code: "INVALID_STORED_FILE" });
        }
        const link = `${randomUUID()}-link.txt`;
        await symlink(path.join(root, ...scope, name), path.join(root, ...scope, link));
        await expect(openStoredMaterial(root, scope, link)).rejects.toThrow();
      }
      await expect(openStoredMaterial(root, [".."], name)).rejects.toMatchObject({ code: "INVALID_STORED_FILE" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

it("rejects storage identity changes through generic metadata", async () => {
  const { assertMaterialStorageUnchanged } = await import("./material-storage");
  expect(() => assertMaterialStorageUnchanged({ storedName: "new" }, { storedName: "old" })).toThrow();
  expect(() => assertMaterialStorageUnchanged({ storedName: "new" }, null)).toThrow();
  expect(() => assertMaterialStorageUnchanged({ storedName: "old", label: "renamed" }, { storedName: "old" })).not.toThrow();
  expect(() => assertMaterialStorageUnchanged({ storedName: "new" }, { storedName: "old" }, true)).not.toThrow();
});
