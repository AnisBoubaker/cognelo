# GitHub Repo Content Plugin Memory

This file is for GitHub repo content plugin memory only.

## Current Decisions

- The plugin content type key is `github-repo`; legacy material records still use `github_repo` until migration phases finish.
- The plugin stores its URL in generic content resource metadata as `{ "url": "https://github.com/org/repo" }`.
- URL validation accepts only `github.com` and `*.github.com` HTTPS URLs.
- URL normalization trims input, forces `https:`, removes hashes, and removes trailing slashes.
- The server plugin implements `getEmbeddingDocuments` by returning the repository URL as an external-reference document and a deferred-indexing diagnostic. Repository cloning/source extraction must be implemented inside this plugin, not in activity plugins.
- The server plugin implements `indexEmbeddingDocuments` and `searchEmbeddingDocuments`. The current dev index is stored in resource metadata under `embeddingIndex`; future repository clone indexing and pgvector/plugin-owned table storage should stay behind those handlers.
- No plugin-owned tables are needed for the first version. Future repository sync/indexing state can add plugin-owned persistence.
- The server `duplicate` handler copies repository metadata but removes `embeddingIndex` so the new resource identity rebuilds derived search state independently.
