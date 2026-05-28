import { describe, expect, it } from "vitest";
import { githubRepoContentPlugin, normalizeGithubRepoUrl } from "./index";
import { githubRepoContentServerPlugin } from "./server";

describe("GitHub repo content plugin", () => {
  it("declares the GitHub repo content type metadata", () => {
    expect(githubRepoContentPlugin).toMatchObject({
      key: "github-repo-content",
      contentTypes: [
        {
          key: "github-repo",
          icon: "github",
          createMode: "shell",
          embeddingSource: "external_url",
          settingsRendererKey: "github-repo-settings"
        }
      ]
    });
  });

  it("normalizes GitHub URLs and rejects non-GitHub hosts", () => {
    expect(normalizeGithubRepoUrl("http://github.com/cognelo/examples///#readme")).toBe("https://github.com/cognelo/examples");
    expect(() => normalizeGithubRepoUrl("https://example.com/cognelo/examples")).toThrow(/github.com/i);
  });

  it("creates and updates safe generic metadata through server handlers", async () => {
    await expect(
      githubRepoContentServerPlugin.handlers?.create?.({
        user: { id: "user-1", email: "u@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
        courseId: "course-1",
        contentTypeKey: "github-repo",
        payload: { title: " Examples ", url: "http://github.com/cognelo/examples/" }
      })
    ).resolves.toEqual({
      title: "Examples",
      metadata: { url: "https://github.com/cognelo/examples" }
    });

    await expect(
      githubRepoContentServerPlugin.handlers?.update?.({
        user: { id: "user-1", email: "u@example.test", name: null, firstName: null, lastName: null, roles: ["teacher" as const] },
        resource: {
          id: "resource-1",
          courseId: "course-1",
          contentTypeKey: "github-repo",
          pluginKey: "github-repo-content",
          title: "Examples",
          metadata: { url: "https://github.com/cognelo/examples" }
        },
        payload: { url: "https://github.com/cognelo/updated/" }
      })
    ).resolves.toEqual({
      metadata: { url: "https://github.com/cognelo/updated" }
    });
  });

  it("returns a generic external URL embedding descriptor", async () => {
    await expect(
      githubRepoContentServerPlugin.handlers?.getEmbeddingSource?.({
        resource: {
          id: "resource-1",
          courseId: "course-1",
          contentTypeKey: "github-repo",
          pluginKey: "github-repo-content",
          title: "Examples",
          metadata: { url: "https://github.com/cognelo/examples" }
        }
      })
    ).resolves.toEqual({
      kind: "external_url",
      url: "https://github.com/cognelo/examples",
      sourceId: "resource-1"
    });
  });
});
