# Web Design Coding Exercises Memory

- Learner payloads use the definition’s allowlisted `studentConfig`; keep keys, solutions, private instructions, and authoring metadata server-side. See [learner data boundaries](docs/REFERENCE.md#learner-data-boundaries).
Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Keep `submittedFiles` in the core submission snapshot. Deleted history renders these retained learner files as code, never by substituting the private reference bundle.
- The [student solution contract](../../../docs/ACTIVITY_SOLUTIONS.md) is capability-driven and default-off. Core gates explicit reveals by current assignment access and the summative grade release; the plugin returns only displayable reference content, never grading internals.

- Keep learner files through live prompt changes; private edits use plugin-owned revisions within the core audit transaction. Enforce release at submission/history APIs, including diagnostic and test-result fields. See [the reference](docs/REFERENCE.md#live-authoring-and-grade-visibility).

- The compound Test answer-review check must inspect response presence only, never correctness or grading evidence; automatically persisted initial state is not a new answer. See [the reference](docs/REFERENCE.md) for this plugin’s criteria.

- Reuse the shared Monaco loader; its asset paths must be absolute and same-origin for blob-worker module fetches. Do not add plugin-local worker URLs.
- Keep this plugin separate from Programming Exercises: browser preview and Playwright grading have different trust and runtime boundaries from Judge0.
- Student starter files are public config; solution files, tests, screenshots, and grading artifacts are private plugin data.
- The learner browser may run only its own bundle in a sandboxed iframe. Graded execution goes through Cognelo to the external Playwright runner. Browser modal APIs are allowed only inside that learner-authored preview; Cognelo teacher UI uses the platform shared dialog provider.
- The endpoint and required authentication token are admin-managed core runner settings, not plugin environment variables. Resolve them through core so later round-robin pooling remains a platform concern.
- Saving enabled tests is reference-validation dependent and atomic; failed validation leaves prior tests unchanged.
- Expected-result prompt tokens expose only generated PNG artifacts, never solution source.
- Standalone drafts use `ActivityResponseDraft`; embedded Test drafts use `TestItemAttempt`.
- Standalone time limits are core assignment policy. Draft/run writes stop at expiry, and `TimedActivityAutoSubmit` uses the ordinary hidden Playwright submit path so the result attaches to the already-started timed core attempt. Until submission, core refreshes the effective deadline from the original start; keep response state intact during policy refresh. Core resolves [team/student exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md); reuse its effective context and grading services rather than querying team policy inside the plugin.
- The definition declares `studentView: { mode: "interactive", execution: "plugin" }`. Teacher Student view stores files in the browser and invokes Playwright without creating plugin submission/test-result rows, core attempts, grades, or analytics.
- Every standalone submission creates a core attempt tagged with its assessment mode. The shared gradebook review page may inspect all submitted file bundles, but applies a core manual-grade override only to summative work; automatic regrading remains hidden until this plugin implements a current-answer grading handler.
- Released final grades are challengeable through core only when the effective summative assignment setting permits it; challenge review must reuse that same file-aware gradebook surface and audited override path.
- Teacher review routes consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Test mutation, authoring, and grade release remain course-management operations.
- Every private bank-owned table must participate in copy, sync, duplication, and deletion hooks, including when a reusable bank Test owns the activity as a hidden child.
- Bank variation starts from that independent copy, preserves exact concept, skill, and misconception selections, then regenerates prompt, starter/reference code, and every Playwright test while preserving file paths and test grading structure. Saving must still validate enabled tests and regenerate any requested expected-result screenshot through the runner.
- The runner remains free of Cognelo application/database secrets and requires production hardening, isolation, and smoke coverage for screenshot cropping. A dedicated runner-specific Bearer token is required and is stored encrypted by the application registry.

- [Submission continuation](../../../docs/SUBMISSION_CONTINUATION.md): Restores files from the exact learner-owned submission to the core response draft without changing the immutable submitted bundle or test results. Ordinary resubmission attaches fresh evidence to the same core attempt. Restore through the host transaction; reopening preserves the original start and applies current exceptions.

- [Compound Test timeout recovery](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) preserves the saved response without a plugin execution or invented grade. Later teacher-triggered [Test regrading](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading) evaluates every child, including already-graded children, while preserving timing, audit evidence, and grade-release gates. AI/manual grade aggregation must not trigger automatic reruns.

- Honor the host [activity content closure policy](../../../docs/ACTIVITY_CONTENT_ACCESS.md) for prompts, histories, solutions, and files. Final submission may return a host-handled closure signal instead of a review payload; preserve records and finalization cleanup.

- [Undo and autosave](../../../docs/EDITOR_UNDO.md): wait for successful draft loading before mounting the editor. Restoration is a baseline, not an undoable edit or an answer write. Keep model history in its mounted attempt/question/file scope only; never persist history or let it cross attempts, users, files, or read-only submission views.

- Reuse `ActionIcon` from `@cognelo/activity-ui` and the shared [action-button rules](../../../docs/ACTION_BUTTONS.md); keep localized labels and action semantics, without plugin-local SVG/emoji substitutes.

- [Answer exports](../../../docs/ANSWER_EXPORTS.md) are read-only plugin projections: Exports display submitted HTML/CSS/JavaScript as escaped source and optionally include stored test results. They never execute student files or invoke the runner.
