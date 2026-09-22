# Programming Exercises Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Public activity config is student-visible. Reference solutions, full templates, hidden tests, rubrics, and raw evaluation artifacts must remain private.
- Judge0 is server-only and all source/input/output fields cross its boundary as Base64. Status 13 is an infrastructure failure, never a learner result or consumed attempt.
- Bank/course private rows require copy, sync, duplication, and deletion hooks. Duplication must copy the complete private configuration; generated reference solutions must merge rather than erase rubrics.
- Enabled hidden tests must pass the private reference solution before save. `{{ STUDENT_CODE }}` is required; `{{ TEST_CODE }}` is the optional per-test harness insertion point.
- Standalone drafts use core `ActivityResponseDraft`; embedded Test drafts use `TestItemAttempt`. Do not mix those persistence paths.
- Summative submissions use core attempts and attempt limits. Practice-run grouping is derived from timestamps around submissions.
- Judge0 output is compared before truncation. Bound new execution/validation diagnostics when saving and bound legacy rows again when serializing them, or one runaway run can stall every later history view.
- Rubrics are general teacher grading tools, not conditional on model feedback. Summative model grading is teacher-triggered; formative feedback may run immediately.
- Original executions and submission-time snapshots remain immutable. Teacher test regrades append private test-evaluation records; teacher-triggered feedback uses the current rubric and latest successful test run, whereas formative/Test-child evaluation retains the submission snapshot. Final grade recomposition uses current component weights and core audited regrade flows; a missing rubric score never counts as zero.
- Rubric and learner feedback generation use the Subject teaching language, not the viewer locale.
- Monaco assets are first-party for SEB compatibility, with the controlled plain-text fallback retained.
