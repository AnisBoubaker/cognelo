# Parsons Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Previous-submission inspection loads history without calling `ensureAttempt`; it must not create a live arrangement or start a timed attempt.
- The [student solution contract](../../../docs/ACTIVITY_SOLUTIONS.md) is capability-driven and default-off. Core gates explicit reveals by current assignment access and the summative grade release; the plugin returns only displayable reference content, never grading internals.

- Live corrections preserve the active attempt and arrangement; server evaluation uses the current solution. Never expose embedded summative evaluation before release, including legacy composite state. See [the reference](docs/REFERENCE.md#live-authoring-and-grade-visibility).

- The compound Test answer-review check must inspect response presence only, never correctness or grading evidence; automatically persisted initial state is not a new answer. Preserve the optional response marker through grading/reopening and disable learner edits until the saved arrangement has loaded. See [the reference](docs/REFERENCE.md) for this plugin’s criteria.

- Groups are line ranges; strict/flexible grouping and precedence rules are part of generic activity config.
- Order feedback counts minimally misplaced units instead of cascading every downstream displacement.
- Learner attempts and move/indent/reset/check/submit events are plugin-owned; teacher previews remain ephemeral.
- The definition declares `studentView: { mode: "interactive", execution: "plugin" }`. Standalone Student view uses browser-scoped state and pure evaluation; the stateless server registration evaluates Parsons items inside preview Tests. Neither path may write attempt or research-event rows.
- Core owns authoring copy/version behavior, including reusable bank-Test child graphs, plus mode-tagged formative/summative attempts, summative gradebook release, and audited regrades.
- Core also owns standalone assignment timing. Parsons persists moves only while the timed attempt is active and responds to `TimedActivityAutoSubmit` with its normal final check/submission; do not add a plugin-local timer or second core attempt. Until submission, core refreshes the effective deadline from the original start; keep response state intact during policy refresh. Core resolves [team/student exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md); reuse its effective context and grading services rather than querying team policy inside the plugin.
- The teacher gradebook-attempt route may be scoped to an exact plugin attempt, always constrained by the participant and activity. The host uses it for newest-first lazy history; older and formative attempts are inspection-only.
- Bank variations keep the exact concept, skill, and misconception selections, source language, group/rule configuration, and exact physical and non-empty solution line counts so copied line ranges stay valid, while regenerating a genuinely different prompt and solution at comparable complexity.
- Summative activity UI does not reveal correctness before release; released feedback is sanitized and deterministic.
- Released final grades are challengeable through core only when the effective summative assignment setting permits it; challenge review must reuse the Parsons **Review and grade** surface and audited grade paths.
- Gradebook attempt review and grading consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Authoring and grade release remain course-management operations.
- Teacher authoring uses the shared guarded draft and `EditActionBar`.

- [Submission continuation](../../../docs/SUBMISSION_CONTINUATION.md): Restores the submitted arrangement on its existing plugin attempt, reopens it, and clears completion/evaluation state after archiving prior state/results. Existing interaction events are retained; ordinary resubmission reuses the core attempt. Restore through the host transaction; reopening preserves the original start and applies current exceptions.

- [Compound Test timeout recovery](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) preserves the saved response without a plugin execution or invented grade. Later teacher-triggered [Test regrading](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading) evaluates every child, including already-graded children, while preserving timing, audit evidence, and grade-release gates. AI/manual grade aggregation must not trigger automatic reruns.

- Display timestamps through the shared application-time context (the effective course zone within course pages) and explicit-zone formatters; the browser timezone is not a user preference. See [Application time](../../../docs/APPLICATION_TIME.md).

- Honor the host [activity content closure policy](../../../docs/ACTIVITY_CONTENT_ACCESS.md) for prompts, histories, solutions, and files. Final submission may return a host-handled closure signal instead of a review payload; preserve records and finalization cleanup.
