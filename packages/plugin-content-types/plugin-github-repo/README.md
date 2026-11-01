# Plugin: GitHub Repo Content

`@cognelo/plugin-github-repo` owns the GitHub repository content type.

It provides picker metadata, GitHub URL validation/normalization, safe display metadata, open-action resolution, embedding source hints for repository URLs, generic extracted-document diagnostics for repository indexing, and vector search handlers.

## Content Type

- `github-repo`

## Persistence

This plugin currently uses generic `CourseContentResource.metadata` for its source data:

```json
{
  "url": "https://github.com/org/repo",
  "embeddingFreshnessHours": 48
}
```

No plugin-owned tables are required yet.

Course content duplication copies the normalized repository metadata and removes any derived embedding index so the new resource can be indexed independently.

The plugin-owned prepared-index service reads public default-branch source at a pinned commit, without cloning or executing it. Core supplies private shared embedding storage/search. Older document/index/search handlers retain URL-only deterministic behavior for legacy consumers.

## Prepared repository indexing

The [Coding Homework workflow](../../../docs/CODING_HOMEWORK_SUBMISSION_WORKFLOW.md#github-freshness) uses actual **public** repository content. The material settings form owns freshness: **48 hours by default**, configurable per repository. Homework checks it when opening submissions and retains pinned reference versions while enabled. Compatible vectors are reused; question-model changes do not invalidate indexes. See the service reference below for extraction bounds and supported formats.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-content-types/plugin-github-repo/README.md`
- `packages/plugin-content-types/plugin-github-repo/PROJECT_MEMORY.md`

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Repository URLs reject embedded credentials and non-HTTP(S) schemes; HTTP is normalized to HTTPS. Run `npm run db:migrate:all` to strip legacy URL userinfo and invalidate its derived index (`202610250020_github_url_credentials`).

## Prepared embedding service

This material provides plugin-owned preparation/refresh through core. See [material embedding services](../../../docs/MATERIAL_EMBEDDING_SERVICES.md) for source extraction, reuse, freshness and limits. The prior deterministic index handlers remain a legacy compatibility path; Coding Homework uses the prepared semantic service.
