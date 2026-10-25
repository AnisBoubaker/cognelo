export const githubRepoContentDatabaseModule = {
  namespace: "plugin_github_repo_content",
  tables: [],
  migrations: [{
    id: "202610250020_github_url_credentials",
    statements: [String.raw`UPDATE "CourseContentResource"
      SET metadata = jsonb_set(metadata - 'embeddingIndex', '{url}', to_jsonb(regexp_replace(metadata->>'url', '^(https?://)[^/?#]*@', '\1', 'i'))), "updatedAt" = NOW()
      WHERE "pluginKey" = 'github-repo-content' AND metadata->>'url' ~* '^https?://[^/?#]*@'`]
  }],
  notes: ["GitHub repo content currently stores safe source metadata in CourseContentResource.metadata."]
} as const;
