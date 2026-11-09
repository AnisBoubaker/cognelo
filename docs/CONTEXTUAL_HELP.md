# Contextual help in teacher interfaces

Status: implemented and locally validated, November 9, 2026.

Teacher workspaces and activity authoring keep explanatory guidance behind the shared circled-question-mark help control immediately after the associated heading or field label, on the same line. Hover and keyboard focus reveal the text; click/tap can keep it open. Escape, outside interaction and leaving the help dismiss it. Floating help is portaled and viewport-bounded so dialogs and scroll containers cannot clip it. Preserve accessible names, existing field descriptions, translations and form behavior.

Move instructions and background explanations, not user-authored descriptions, required confirmation messages, errors, current operation results or actionable warnings. Disabled controls must still offer their contextual explanation. Shared editors and authoring dialogs follow the same pattern.

Display timezone names only where the administrator/course owner actually chooses the timezone. Routine date/time fields, labels, deadlines and timestamps use that configured zone silently; removing reminders must never alter UTC persistence, parsing, server-clock enforcement or permission to configure the zone.

## Delivery checkpoints

- [x] Shared localized help primitive, focus/touch/Escape behavior, portal positioning and tests.
- [x] Scheduling and repeated timezone reminders.
- [x] Course, subject, bank, roster, grading and teacher settings rollout.
- [x] Activity editors and shared authoring tools rollout.
- [x] Accessibility/mobile/regression checks, documentation review and incremental commits.

## Coverage and validation

Core teacher pages use the same help control for course/subject/bank authoring, roster and staff management, groupings, references, grading/export, scheduling and administrative settings. Activity authoring includes Programming Exercises, Programming Homework, MCQ, Parsons and core Tests. Shared Concepts, AI-model selection and rich-text image/equation/table dialogs also use it. File contents, authored descriptions, current readiness/results and learner task instructions retain their normal presentation. Keep interactive editing controls outside help content.

Validation passed: 2,047 unit tests across 342 files, all workspace typechecks and plugin boundary checks, and 34 distinct local E2E scenarios across focused/regression runs. Browser coverage includes after-label geometry, hover/focus/pinning/Escape, touch viewport bounds, help for disabled stages, no accidental settings writes, retained drafts across five activity types, actual MCQ/Parsons setting edits and reload, course/admin pages, bank/course solution files and PDFs, AI connection consumers, Test instructions, team management, scheduling/lateness and rich-text media retention. Date-entry regressions still verify the saved UTC instants from a differently configured browser. Desktop/mobile screenshots were inspected. Lint has no errors; existing hook-dependency warnings remain.

The root orientation/index, shared authoring manual, timezone/stage/editor references and affected plugin README/memory/reference files were reviewed and updated. No documentation verification gap remains.

No database migrations or production actions are part of this UI change.
