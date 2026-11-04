import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@cognelo/core", async original => ({ ...await original<typeof import("@cognelo/core")>(), fetchPublicMaterial: mocks.fetch }));
import { githubMaterialIndexing, githubFreshnessHours, isGithubTeachingSourcePath } from "./indexing";
it("indexes public default-branch source at an immutable commit and skips symlinks/build output", async () => {
  const commit = "a".repeat(40), tree = "b".repeat(40);
  mocks.fetch.mockImplementation(async (url: string) => ({ bytes: Buffer.from(url.endsWith("/repos/course/example") ? JSON.stringify({ private: false, default_branch: "main" }) : url.includes("/commits/") ? JSON.stringify({ sha: commit }) : url.includes("/git/trees/") ? JSON.stringify({ sha: tree, tree: [{ path: "src/main.c", type: "blob", mode: "100644", size: 20 }, { path: "link.c", type: "blob", mode: "120000" }, { path: "node_modules/lib.c", type: "blob", mode: "100644" }] }) : "int main(void) { return 0; }") }));
  const store = vi.fn().mockResolvedValue({ id: "index" });
  await githubMaterialIndexing.prepare({ resource: { id: "material", courseId: "course", title: "C example", contentTypeKey: "github-repo", pluginKey: "github-repo-content", metadata: { url: "https://github.com/course/example" } }, user: { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] }, store });
  expect(mocks.fetch.mock.calls.at(-1)?.[0]).toBe(`https://raw.githubusercontent.com/course/example/${commit}/src/main.c`);
  expect(store.mock.calls[0][0].documents).toHaveLength(1);
  expect(store.mock.calls[0][0].documents[0].text).toContain("int main");
  expect(githubFreshnessHours()).toBe(48); expect(githubFreshnessHours({ embeddingFreshnessHours: 12 })).toBe(12);
});

it.each(["project/.idea/editor.xml", ".vscode/settings.json", "project/.vs/settings.json", "project/cmake-build-debug/CMakeCache.txt", "project/cmake-build-release/CMakeFiles/compiler.c", "project/CMakeFiles/compiler.c", "node_modules/library/index.js", "__MACOSX/src/._main.c", "src/._main.c", "project/__pycache__/generated.py", ".venv/library/module.py"])("excludes editor/generated metadata before fetching: %s", path => {
  expect(isGithubTeachingSourcePath(path)).toBe(false);
});

it.each(["session/main.c", "modules/chaines.h", "CMakeLists.txt", "lessons/config.xml", ".github/workflows/lesson.yml", "docs/README.md", "src/builder/main.c"])("retains authored source, docs and build configuration: %s", path => {
  expect(isGithubTeachingSourcePath(path)).toBe(true);
});

it("ignores large IDE caches before applying source-size limits and never downloads them", async () => {
  const sha = "c".repeat(40);
  mocks.fetch.mockClear();
  mocks.fetch.mockImplementation(async (url: string) => ({ bytes: Buffer.from(url.endsWith("/repos/course/example") ? JSON.stringify({ private: false, default_branch: "main" })
    : url.includes("/commits/") ? JSON.stringify({ sha })
    : url.includes("/git/trees/") ? JSON.stringify({ sha, tree: [
      { path: "lesson/.idea/editor.xml", type: "blob", mode: "100644", size: 8 * 1024 * 1024 },
      { path: "lesson/cmake-build-debug/CMakeCache.txt", type: "blob", mode: "100644", size: 8 * 1024 * 1024 },
      { path: "lesson/main.c", type: "blob", mode: "100644", size: 40 },
      { path: "lesson/CMakeLists.txt", type: "blob", mode: "100644", size: 40 }
    ] }) : url.endsWith("main.c") ? "int sum(int a, int b) { return a + b; }" : "add_executable(lesson main.c)") }));
  const store = vi.fn().mockResolvedValue({ id: "index" });
  await githubMaterialIndexing.prepare({ resource: { id: "material", courseId: "course", title: "Class examples", contentTypeKey: "github-repo", pluginKey: "github-repo-content", metadata: { url: "https://github.com/course/example" } }, user: { id: "teacher", email: "teacher@example.test", name: null, firstName: null, lastName: null, roles: ["teacher"] }, store });
  expect(store.mock.calls[0][0].documents.map((document: { path: string }) => document.path)).toEqual(["lesson/CMakeLists.txt", "lesson/main.c"]);
  expect(mocks.fetch.mock.calls.some(([url]) => /\.idea|cmake-build/.test(url))).toBe(false);
});
