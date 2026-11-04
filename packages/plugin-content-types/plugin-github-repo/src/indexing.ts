import { AppError, contentIndexRevision, fetchPublicMaterial } from "@cognelo/core";
import type { ContentIndexingService, ContentEmbeddingDocument } from "@cognelo/content-type-sdk/server";

const ignoredSourceDirectories = new Set([".git", ".hg", ".svn", ".idea", ".vscode", ".vs", "node_modules", "vendor", "dist", "build", "coverage", ".next", "cmakefiles", "__macosx", "__pycache__", ".pytest_cache", ".mypy_cache", ".cache", ".venv", "venv"]);
export function isGithubTeachingSourcePath(path: string) {
  const segments = path.split("/");
  const filename = segments.pop() ?? "";
  if (segments.some(segment => ignoredSourceDirectories.has(segment.toLowerCase()) || /^cmake-build(?:[-_].*)?$/i.test(segment))) return false;
  return !filename.startsWith("._") && /\.(c|h|cpp|hpp|cc|md|txt|py|java|js|ts|html|css|json|xml|yaml|yml)$/i.test(filename);
}

export function githubFreshnessHours(metadata?: Record<string, unknown>) {
  const value = metadata?.embeddingFreshnessHours;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8760 ? value : 48;
}
export const githubMaterialIndexing: ContentIndexingService = {
  policy: resource => ({ revision: contentIndexRevision({ url: resource.metadata?.url, title: resource.title, extractionVersion: "teaching-source-v2" }), maxAgeHours: githubFreshnessHours(resource.metadata) }),
  async prepare({ resource, store, signal }) {
    const url = new URL(String(resource.metadata?.url ?? ""));
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || parts.length !== 2 || parts.some(part => !/^[\w.-]+$/.test(part))) throw new AppError(422, "GITHUB_REPOSITORY_URL_REQUIRED", "Use the root URL of a public GitHub repository.");
    const repo = `${parts[0]}/${parts[1].replace(/\.git$/, "")}`;
    const info = JSON.parse((await fetchPublicMaterial(`https://api.github.com/repos/${repo}`, { signal })).bytes.toString("utf8")) as { private: boolean; default_branch: string };
    if (info.private || !info.default_branch) throw new AppError(422, "GITHUB_PUBLIC_REPOSITORY_REQUIRED", "Only public repositories with a default branch can be indexed.");
    const commit = JSON.parse((await fetchPublicMaterial(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(info.default_branch)}`, { signal, maxBytes: 5 * 1024 * 1024 })).bytes.toString("utf8")) as { sha: string };
    if (!/^[a-f0-9]{40,64}$/i.test(commit.sha)) throw new AppError(422, "GITHUB_REVISION_INVALID", "Could not resolve the repository revision.");
    const tree = JSON.parse((await fetchPublicMaterial(`https://api.github.com/repos/${repo}/git/trees/${commit.sha}?recursive=1`, { signal, maxBytes: 5 * 1024 * 1024 })).bytes.toString("utf8")) as { sha: string; truncated?: boolean; tree: Array<{ path: string; type: string; size?: number; mode: string }> };
    if (tree.truncated || !Array.isArray(tree.tree) || !/^[a-f0-9]{40,64}$/i.test(tree.sha)) throw new AppError(413, "GITHUB_TREE_LIMIT", "The repository tree cannot be fully indexed. Use a smaller teaching repository.");
    const selected = tree.tree.filter(file => file.type === "blob" && file.mode !== "120000" && isGithubTeachingSourcePath(file.path));
    if (selected.length > 200 || selected.some(file => (file.size ?? 0) > 512 * 1024) || selected.reduce((sum, file) => sum + (file.size ?? 0), 0) > 4 * 1024 * 1024) throw new AppError(413, "GITHUB_SOURCE_LIMIT", "The repository exceeds the source extraction limit (200 files, 512 KB per file, 4 MB total).");
    const documents: ContentEmbeddingDocument[] = []; let total = 0;
    for (const file of selected.sort((a, b) => a.path.localeCompare(b.path))) {
      const result = await fetchPublicMaterial(`https://raw.githubusercontent.com/${repo}/${commit.sha}/${file.path.split("/").map(encodeURIComponent).join("/")}`, { signal, maxBytes: 512 * 1024 });
      total += result.bytes.length;
      if (total > 4 * 1024 * 1024) throw new AppError(413, "GITHUB_SOURCE_LIMIT", "The repository exceeds the text extraction limit.");
      const text = result.bytes.toString("utf8");
      if (!text.trim() || text.includes("\u0000")) continue;
      documents.push({ id: `${resource.id}:${file.path}`, sourceId: resource.id, title: resource.title, text, path: file.path, kind: /\.(md|txt)$/i.test(file.path) ? "markdown" : "code", languageKey: /\.(c|h)$/i.test(file.path) ? "c" : null, metadata: { url: resource.metadata?.url, revision: commit.sha } });
    }
    return store({ sourceId: resource.id, documents, diagnostics: [] });
  }
};
