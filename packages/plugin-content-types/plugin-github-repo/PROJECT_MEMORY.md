# GitHub Repo Content Plugin Memory

This file is for GitHub repo content plugin memory only.

## Current Decisions

- The plugin content type key is `github-repo`; legacy material records still use `github_repo` until migration phases finish.
- The plugin stores its URL in generic content resource metadata as `{ "url": "https://github.com/org/repo" }`.
- URL validation accepts only `github.com` and `*.github.com` HTTPS URLs.
- URL normalization trims input, forces `https:`, removes hashes, and removes trailing slashes.
- No plugin-owned tables are needed for the first version. Future repository sync/indexing state can add plugin-owned persistence.
