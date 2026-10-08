# MCQ Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Preserve the single text-first source; do not replace it with a click-heavy form builder.
- Question and section boundaries are grammar-significant. Plain trailing text remains part of the preceding choice unless `#` or `---` starts a section.
- Stable choice IDs survive optional display randomization and remain the grading identity.
- All authored data is generic config; core can therefore deep-copy MCQ children across reusable bank Tests without a private-data hook. Plugin-owned `PluginMcqAiEvaluation` rows are immutable operational artifacts only.
- Bank variation preserves exact concept, skill, and misconception selections and the original question count/settings, but generates a distinct student introduction and MCQ source. The normal parser, exact-count validation, and model answer-key audit remain mandatory before the target draft is saved.
- Deterministic answer-key grading is authoritative. Feedback generation and teacher edits must never return a grading result.
- **Assess with AI** is feedback-only for MCQ. The shared **Review and grade** host may still apply an explicit audited teacher override to the final grade; that override is separate from MCQ feedback generation or revision.
- Model explanations are not an independent challenge target because they do not affect scoring. The released deterministic/overridden grade and teacher-authored released feedback are challengeable through core.
- Standalone and compound-Test draft paths are distinct and must not be mixed.
- The definition declares `studentView: { mode: "interactive", execution: "plugin" }`. This is a third browser-scoped path: answer checks are deterministic and stateless, with no draft, attempt, grade, feedback artifact, or analytics persistence.
- Attempt limits are enforced by both status UI and the submission route. Released final grades close further attempts.
- Every standalone answer check/submission creates a core attempt with the assignment mode. Student summative history and limits select only summative attempts; teacher history can inspect both modes.
- The teacher gradebook-attempt route accepts an exact attempt ID constrained by course, group, activity, and participant so the shared report can load newest-first and fetch older payloads lazily. Historical and formative attempts are read-only in that dialog.
- Gradebook attempt review and grading consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Authoring and grade release remain course-management operations.
- Teacher feedback and learner copy use mechanism-neutral wording.
