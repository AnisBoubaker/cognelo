# Plugin: GitHub Repo Content

`@cognelo/plugin-github-repo` owns the GitHub repository content type.

It provides picker metadata, GitHub URL validation/normalization, safe display metadata, open-action resolution, embedding source hints for repository URLs, generic extracted-document diagnostics for repository indexing, and vector search handlers.

## Content Type

- `github-repo`

## Persistence

This plugin currently uses generic `CourseContentResource.metadata` for its source data:

```json
{
  "url": "https://github.com/org/repo"
}
```

No plugin-owned tables are required yet.

Course content duplication copies the normalized repository metadata and removes any derived embedding index so the new resource can be indexed independently.

Repository cloning and source extraction are owned by this plugin. The current implementation exposes the repository URL as an external-reference document, stores a deterministic development vector index in resource metadata, and reports repository indexing as deferred through the shared content type server extraction interface.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-content-types/plugin-github-repo/README.md`
- `packages/plugin-content-types/plugin-github-repo/PROJECT_MEMORY.md`
