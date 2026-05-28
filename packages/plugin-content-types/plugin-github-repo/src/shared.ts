export function normalizeGithubRepoUrl(value: string) {
  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && !host.endsWith(".github.com")) {
    throw new Error("GitHub repository content must use a github.com URL.");
  }
  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}
