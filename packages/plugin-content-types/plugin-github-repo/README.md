# Plugin: GitHub Repo Content

`@cognelo/plugin-github-repo` owns the GitHub repository content type.

It provides picker metadata, GitHub URL validation/normalization, safe display metadata, open-action resolution, and embedding source hints for repository URLs.

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

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-content-types/plugin-github-repo/README.md`
- `packages/plugin-content-types/plugin-github-repo/PROJECT_MEMORY.md`
