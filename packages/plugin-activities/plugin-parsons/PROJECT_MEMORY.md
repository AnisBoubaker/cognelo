# Parsons Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Groups are line ranges; strict/flexible grouping and precedence rules are part of generic activity config.
- Order feedback counts minimally misplaced units instead of cascading every downstream displacement.
- Learner attempts and move/indent/reset/check/submit events are plugin-owned; teacher previews remain ephemeral.
- Core owns authoring copy/version behavior, including reusable bank-Test child graphs, plus mode-tagged formative/summative attempts, summative gradebook release, and audited regrades.
- Summative activity UI does not reveal correctness before release; released feedback is sanitized and deterministic.
- Released final grades are challengeable through core; challenge review must reuse the Parsons **Review and grade** surface and audited grade paths.
- Teacher authoring uses the shared guarded draft and `EditActionBar`.
