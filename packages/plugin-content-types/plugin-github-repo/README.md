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

## Approved Indexing Target — Implementation Pending

The [Coding Homework workflow decisions](../../../docs/CODING_HOMEWORK_SUBMISSION_WORKFLOW.md#github-freshness) require real content extraction from **public** repositories and a GitHub-material freshness setting: **48 hours by default, configurable for each repository**. Coding Homework checks this age when enabling final submissions and refreshes stale selected repositories before opening. It does not regenerate references during the enabled workflow. Compatible existing vectors are reused across homework selections. The URL-only development behavior above remains the current implementation.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-content-types/plugin-github-repo/README.md`
- `packages/plugin-content-types/plugin-github-repo/PROJECT_MEMORY.md`

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Repository URLs reject embedded credentials and non-HTTP(S) schemes; HTTP is normalized to HTTPS. Run `npm run db:migrate:all` to strip legacy URL userinfo and invalidate its derived index (`202610250020_github_url_credentials`).

## Prepared embedding service

This material provides plugin-owned preparation/refresh through core. See [material embedding services](../../../docs/MATERIAL_EMBEDDING_SERVICES.md) for source extraction, reuse, freshness and limits. The prior deterministic index handlers remain a legacy compatibility path; Coding Homework uses the prepared semantic service.
