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
- Question prompts and choices render Markdown images, including web URLs, and portable GFM tables in addition to text, math, lists, and fenced code.
- Authored content is generic activity config, so core owns bank copying, synchronization, and version comparison.
- Reusable bank Tests copy MCQ children into Test-owned bank activities and later into independent course children without plugin-private authoring rows.
- Standalone answers autosave through `ActivityResponseDraft`; compound Test answers use `TestItemAttempt`.
- Formative **Check answers** and summative submissions both create mode-tagged core attempts. Only summative attempts use limits, gradebook selection, grading, and release visibility; teachers can inspect formative attempts read-only.
- Teacher review resolves an exact core MCQ attempt. The report dialog loads only the newest current-mode submission initially and requests older submissions as the teacher navigates; historical and formative attempts remain read-only.
- Optional model feedback can explain results but never changes deterministic MCQ grades and is not independently challengeable. The released deterministic grade and teacher-authored released feedback remain challengeable through the core workflow when the effective summative assignment setting permits it.
- Activity-bank variations preserve the selected concepts, skills, and misconceptions, question count, code-language setting, and difficulty while generating a new student introduction, questions, choices, and independently audited answer key. Reusable Test variation applies the same operation to each MCQ child.
- The definition declares interactive, plugin-executed Student view support; the learner questionnaire uses browser-scoped answers and deterministic, non-persistent checking.
- AI question generation and formative model feedback use the shared blocking, indeterminate progress dialog; variation progress is supplied by the activity-bank background job.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
