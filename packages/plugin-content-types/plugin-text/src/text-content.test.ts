import { describe, expect, it } from "vitest";
import { textContentPlugin } from "./index";
import { textContentServerPlugin } from "./server";

describe("text content plugin", () => {
  it("declares text content metadata", () => {
    expect(textContentPlugin.contentTypes[0]).toMatchObject({
      key: "text",
      icon: "text",
      createMode: "shell",
      embeddingSource: "text_body",
      settingsRendererKey: "text-content-settings"
    });
  });

  it("creates and updates text metadata", async () => {
    const user = { id: "u", email: "u@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] };
    await expect(
      textContentServerPlugin.handlers?.create?.({
        user,
        courseId: "course-1",
        contentTypeKey: "text",
        payload: { title: "Note", body: "Hello" }
      })
    ).resolves.toEqual({ title: "Note", metadata: { body: "Hello", format: "markdown" } });

    await expect(
      textContentServerPlugin.handlers?.getEmbeddingSource?.({
        resource: {
          id: "resource-1",
          courseId: "course-1",
          contentTypeKey: "text",
          pluginKey: "text-content",
          title: "Note",
          metadata: { body: "Hello", format: "markdown" }
        }
      })
    ).resolves.toEqual({ kind: "text", text: "Hello", sourceId: "resource-1" });
  });
});
