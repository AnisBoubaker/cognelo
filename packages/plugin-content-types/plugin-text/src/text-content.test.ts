import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  courseContentResource: {
    update: vi.fn()
  }
}));

vi.mock("@cognelo/db", () => ({
  Prisma: {},
  prisma: dbMocks
}));

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

    await expect(
      textContentServerPlugin.handlers?.getEmbeddingDocuments?.({
        resource: {
          id: "resource-1",
          courseId: "course-1",
          contentTypeKey: "text",
          pluginKey: "text-content",
          title: "Note",
          metadata: { body: "Hello", format: "markdown" }
        }
      })
    ).resolves.toEqual({
      sourceId: "resource-1",
      documents: [
        {
          id: "resource-1:body",
          sourceId: "resource-1",
          title: "Note",
          text: "Hello",
          kind: "markdown",
          metadata: { format: "markdown" }
        }
      ],
      diagnostics: []
    });
  });

  it("indexes and searches text vectors inside the content plugin boundary", async () => {
    dbMocks.courseContentResource.update.mockResolvedValue({});
    const resource = {
      id: "resource-1",
      courseId: "course-1",
      contentTypeKey: "text",
      pluginKey: "text-content",
      title: "Functions",
      metadata: { body: "int add(int a, int b) { return a + b; }", format: "markdown" }
    };

    await expect(
      textContentServerPlugin.handlers?.indexEmbeddingDocuments?.({
        user: { id: "u", email: "u@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
        resource
      })
    ).resolves.toMatchObject({
      sourceId: "resource-1",
      documentCount: 1,
      vectorCount: 1
    });

    const result = await textContentServerPlugin.handlers?.searchEmbeddingDocuments?.({
      user: { id: "u", email: "u@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
      resource,
      queryText: "add numbers",
      limit: 1
    });

    expect(result?.matches[0]).toMatchObject({
      documentId: "resource-1:body",
      sourceId: "resource-1",
      title: "Functions"
    });
    expect(dbMocks.courseContentResource.update).toHaveBeenCalled();
  });
});
