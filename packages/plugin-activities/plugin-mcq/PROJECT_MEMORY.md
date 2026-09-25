# MCQ Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Preserve the single text-first source; do not replace it with a click-heavy form builder.
- Question and section boundaries are grammar-significant. Plain trailing text remains part of the preceding choice unless `#` or `---` starts a section.
- Stable choice IDs survive optional display randomization and remain the grading identity.
- All authored data is generic config; core can therefore deep-copy MCQ children across reusable bank Tests without a private-data hook. Plugin-owned `PluginMcqAiEvaluation` rows are immutable operational artifacts only.
- Deterministic answer-key grading is authoritative. Feedback generation and teacher edits must never return a grading result.
- **Assess with AI** is feedback-only for MCQ. The shared **Review and grade** host may still apply an explicit audited teacher override to the final grade; that override is separate from MCQ feedback generation or revision.
- Standalone and compound-Test draft paths are distinct and must not be mixed.
- Attempt limits are enforced by both status UI and the submission route. Released final grades close further attempts.
- Teacher feedback and learner copy use mechanism-neutral wording.
