# Plugin: MCQ

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity. Teachers author one portable Markdown-like source document; learners receive accessible choice controls and deterministic answer-key grading.

Gradebook attempt review and grading use core grade scope, so explicit course teachers/admins work course-wide while section teachers/TAs are limited to assigned sections; authoring and release remain course-management operations.

## Read By Topic

- [Source grammar and authoring model](docs/REFERENCE.md#authoring-model)
- [Attempts, drafts, compound Tests, and current behavior](docs/REFERENCE.md#current-state)
- [Assessment feedback](docs/REFERENCE.md#ai-assessment-feedback)
- [Detailed decisions](docs/DECISIONS.md)

## Core Behavior

- `##` starts a question; `- [x]` and `- [ ]` mark correct and incorrect choices.
- `#` and `---` create titled and untitled content sections between questions.
- Authored content is generic activity config, so core owns bank copying, synchronization, and version comparison.
- Reusable bank Tests copy MCQ children into Test-owned bank activities and later into independent course children without plugin-private authoring rows.
- Standalone answers autosave through `ActivityResponseDraft`; compound Test answers use `TestItemAttempt`.
- Formative **Check answers** and summative submissions both create mode-tagged core attempts. Only summative attempts use limits, gradebook selection, grading, and release visibility; teachers can inspect formative attempts read-only.
- Optional model feedback can explain results but never changes deterministic MCQ grades and is not independently challengeable. The released deterministic grade and teacher-authored released feedback remain challengeable through the core workflow.
- Activity-bank variations preserve the selected concepts, skills, and misconceptions, question count, code-language setting, and difficulty while generating a new student introduction, questions, choices, and independently audited answer key. Reusable Test variation applies the same operation to each MCQ child.
- AI question generation and formative model feedback use the shared blocking, indeterminate progress dialog; variation progress is supplied by the activity-bank background job.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
