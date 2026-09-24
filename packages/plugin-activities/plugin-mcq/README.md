# Plugin: MCQ

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity. Teachers author one portable Markdown-like source document; learners receive accessible choice controls and deterministic answer-key grading.

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
- Summative submissions use core attempts, limits, gradebook selection, and release visibility.
- Optional model feedback can explain results but never changes deterministic MCQ grades and is not challengeable.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
