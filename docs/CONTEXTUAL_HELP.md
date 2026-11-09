# Contextual help in teacher interfaces

Status: implementation in progress, November 9, 2026.

Teacher workspaces and activity authoring keep explanatory guidance behind the shared circled-question-mark help control immediately after the associated heading or field label, on the same line. Hover and keyboard focus reveal the text; click/tap can keep it open. Escape, outside interaction and leaving the help dismiss it. Floating help is portaled and viewport-bounded so dialogs and scroll containers cannot clip it. Preserve accessible names, existing field descriptions, translations and form behavior.

Move instructions and background explanations, not user-authored descriptions, required confirmation messages, errors, current operation results or actionable warnings. Disabled controls must still offer their contextual explanation. Shared editors and authoring dialogs follow the same pattern.

Display timezone names only where the administrator/course owner actually chooses the timezone. Routine date/time fields, labels, deadlines and timestamps use that configured zone silently; removing reminders must never alter UTC persistence, parsing, server-clock enforcement or permission to configure the zone.

## Delivery checkpoints

- [x] Shared localized help primitive, focus/touch/Escape behavior, portal positioning and tests.
- [ ] Scheduling and repeated timezone reminders.
- [ ] Course, subject, bank, roster, grading and teacher settings rollout.
- [ ] Activity editors and shared authoring tools rollout.
- [ ] Accessibility/mobile/regression checks, documentation review and incremental commits.

No database migrations or production actions are part of this UI change.
