import { describe, expect, it } from "vitest";
import { fileContentPlugin } from "./index";
import { fileContentServerPlugin } from "./server";

describe("file content plugin", () => {
  it("declares file content metadata", () => {
    expect(fileContentPlugin.contentTypes[0]).toMatchObject({
      key: "file",
      icon: "file",
      createMode: "upload",
      embeddingSource: "file_upload",
      settingsRendererKey: "file-content-settings"
    });
  });

  it("creates draft file content resources", async () => {
    await expect(
      fileContentServerPlugin.handlers?.create?.({
        user: { id: "u", email: "u@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
        courseId: "course-1",
        contentTypeKey: "file",
        payload: { title: "Slides" }
      })
    ).resolves.toEqual({
      title: "Slides",
      metadata: { setupStatus: "draft" }
    });
  });

  it("returns a generic file embedding descriptor for uploaded files", async () => {
    await expect(
      fileContentServerPlugin.handlers?.getEmbeddingSource?.({
        resource: {
          id: "resource-1",
          courseId: "course-1",
          contentTypeKey: "file",
          pluginKey: "file-content",
          title: "Slides",
          metadata: {
            storedName: "stored-slides.pdf",
            mimeType: "application/pdf",
            originalName: "slides.pdf"
          }
        }
      })
    ).resolves.toEqual({
      kind: "file",
      fileRef: "stored-slides.pdf",
      mimeType: "application/pdf",
      sourceId: "resource-1"
    });
  });
});
