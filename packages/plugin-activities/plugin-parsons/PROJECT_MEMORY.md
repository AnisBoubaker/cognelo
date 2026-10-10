# Parsons Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Groups are line ranges; strict/flexible grouping and precedence rules are part of generic activity config.
- Order feedback counts minimally misplaced units instead of cascading every downstream displacement.
- Learner attempts and move/indent/reset/check/submit events are plugin-owned; teacher previews remain ephemeral.
- The definition declares `studentView: { mode: "interactive", execution: "plugin" }`. Standalone Student view uses browser-scoped state and pure evaluation; the stateless server registration evaluates Parsons items inside preview Tests. Neither path may write attempt or research-event rows.
- Core owns authoring copy/version behavior, including reusable bank-Test child graphs, plus mode-tagged formative/summative attempts, summative gradebook release, and audited regrades.
- The teacher gradebook-attempt route may be scoped to an exact plugin attempt, always constrained by the participant and activity. The host uses it for newest-first lazy history; older and formative attempts are inspection-only.
- Bank variations keep the exact concept, skill, and misconception selections, source language, group/rule configuration, and exact physical and non-empty solution line counts so copied line ranges stay valid, while regenerating a genuinely different prompt and solution at comparable complexity.
- Summative activity UI does not reveal correctness before release; released feedback is sanitized and deterministic.
- Released final grades are challengeable through core only when the effective summative assignment setting permits it; challenge review must reuse the Parsons **Review and grade** surface and audited grade paths.
- Gradebook attempt review and grading consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Authoring and grade release remain course-management operations.
- Teacher authoring uses the shared guarded draft and `EditActionBar`.
