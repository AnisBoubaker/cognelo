import { describe, expect, it } from "vitest";
import { materialIconName, materialTypeByKind, materialTypeDefinitions } from "./material-types";

describe("material type registry", () => {
  it("registers picker material types with labels, icons, defaults, and embedding sources", () => {
    expect(materialTypeDefinitions).toEqual([
      expect.objectContaining({
        kind: "github_repo",
        labelKey: "materialKinds.github_repo",
        defaultTitleKey: "courseDetail.defaultRepoTitle",
        icon: "github",
        embeddingSource: "external_url"
      }),
      expect.objectContaining({
        kind: "file",
        labelKey: "materialKinds.file",
        defaultTitleKey: "courseDetail.defaultFileTitle",
        icon: "file",
        embeddingSource: "file_upload"
      }),
      expect.objectContaining({
        kind: "text",
        labelKey: "materialKinds.text",
        defaultTitleKey: "courseDetail.defaultTextTitle",
        icon: "text",
        embeddingSource: "text_body"
      })
    ]);
  });

  it("resolves known material types and falls back to a file icon", () => {
    expect(materialTypeByKind("text")).toMatchObject({ icon: "text" });
    expect(materialIconName("github_repo")).toBe("github");
    expect(materialIconName("pdf")).toBe("file");
    expect(materialIconName(null)).toBe("file");
  });
});
