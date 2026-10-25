import { z } from "zod";

export const githubRepoUrlSchema = z.string().trim().url().transform((value, context) => {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || (host !== "github.com" && !host.endsWith(".github.com"))) {
    context.addIssue({ code: "custom", message: "GitHub repository content must use an HTTP(S) github.com URL without embedded credentials." });
    return z.NEVER;
  }
  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
});

export function normalizeGithubRepoUrl(value: string) {
  return githubRepoUrlSchema.parse(value);
}
