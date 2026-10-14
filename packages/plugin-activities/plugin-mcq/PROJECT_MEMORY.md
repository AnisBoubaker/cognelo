# MCQ Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- The [student solution contract](../../../docs/ACTIVITY_SOLUTIONS.md) is capability-driven and default-off. Core gates explicit reveals by current assignment access and the summative grade release; the plugin returns only displayable reference content, never grading internals.

- Preserve choices when live prompts/keys change; result and history APIs must enforce core grade release before returning summative scores. See [the reference](docs/REFERENCE.md#live-authoring-and-grade-visibility).

- The compound Test answer-review check must inspect response presence only, never correctness or grading evidence; automatically persisted initial state is not a new answer. See [the reference](docs/REFERENCE.md) for this plugin’s criteria.

- Preserve the single text-first source; do not replace it with a click-heavy form builder.
- Question prompts and choices use the shared sanitized Markdown renderer for inline content and GFM tables, including responsive images from Cognelo or web URLs; structural `##` and task-list markers remain owned by the MCQ parser.
- Question and section boundaries are grammar-significant. Plain trailing text remains part of the preceding choice unless `#` or `---` starts a section.
- Stable choice IDs survive optional display randomization and remain the grading identity.
- All authored data is generic config; core can therefore deep-copy MCQ children across reusable bank Tests without a private-data hook. Plugin-owned `PluginMcqAiEvaluation` rows are immutable operational artifacts only.
- `PluginMcqAiEvaluation` is declared and queried only through the MCQ-local Prisma schema/client. Its original core migration remains immutable migration history, not current core model ownership.
- Bank variation preserves exact concept, skill, and misconception selections and the original question count/settings, but generates a distinct student introduction and MCQ source. The normal parser, exact-count validation, and model answer-key audit remain mandatory before the target draft is saved.
- Deterministic answer-key grading is authoritative. Feedback generation and teacher edits must never return a grading result.
- **Assess with AI** is feedback-only for MCQ. The shared **Review and grade** host may still apply an explicit audited teacher override to the final grade; that override is separate from MCQ feedback generation or revision.
- Model explanations are not an independent challenge target because they do not affect scoring. The released deterministic/overridden grade and teacher-authored released feedback are challengeable through core only when the effective summative assignment setting permits it.
- Standalone and compound-Test draft paths are distinct and must not be mixed.
- Standalone timing is core assignment policy. Do not add an MCQ time setting: after the host's explicit start, MCQ must answer `TimedActivityAutoSubmit` by using its ordinary formative check or summative submission so the same core attempt is finalized. Until submission, core refreshes the effective deadline from the original start, capped by the resolved Until date; keep response state intact during policy refresh. Core resolves [team/student exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md); reuse its effective context and grading services rather than querying team policy inside the plugin.
- The definition declares `studentView: { mode: "interactive", execution: "plugin" }`. This is a third browser-scoped path: answer checks are deterministic and stateless, with no draft, attempt, grade, feedback artifact, or analytics persistence.
- Attempt limits are enforced by both status UI and the submission route. Released final grades close further attempts.
- Every standalone answer check/submission creates a core attempt with the assignment mode. Both assignment policies `formative` and `formative_ai` create a core `formative` attempt; only explicit `formative_ai` may invoke and expose automatic feedback. Student summative history and limits select only summative attempts; teacher history can inspect both modes.
- Generated formative feedback is linked to the exact core attempt and plugin submission. Learner **Previous submissions** displays it only while the effective assignment uses `formative_ai`; ordinary formative suppresses legacy model feedback.
- The teacher gradebook-attempt route accepts an exact attempt ID constrained by course, group, activity, and participant so the shared report can load newest-first and fetch older payloads lazily. Historical and formative attempts are read-only in that dialog, including any generated feedback attached to the inspected attempt.
- Gradebook attempt review and grading consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Authoring and grade release remain course-management operations.
- Teacher feedback and learner copy use mechanism-neutral wording.

- [Submission continuation](../../../docs/SUBMISSION_CONTINUATION.md): Restores the submitted choices to the core response draft; the ordinary submission path reuses the reopened core attempt. Restore through the host transaction; reopening preserves the original start and applies current exceptions.
