# Parsons Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Groups are line ranges; strict/flexible grouping and precedence rules are part of generic activity config.
- Order feedback counts minimally misplaced units instead of cascading every downstream displacement.
- Learner attempts and move/indent/reset/check/submit events are plugin-owned; teacher previews remain ephemeral.
- Core owns authoring copy/version behavior, summative attempts, gradebook release, and audited regrades.
- Summative activity UI does not reveal correctness before release; released feedback is sanitized and deterministic.
- Teacher authoring uses the shared guarded draft and `EditActionBar`.
