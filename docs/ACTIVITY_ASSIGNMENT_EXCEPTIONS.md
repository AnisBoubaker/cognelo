# Activity assignment exceptions

Implemented in the activity settings dialog's **Exceptions** tab. Course managers select a section, add teams or individual student enrollments, and check only the settings to replace. Changes, removals, and priority moves share the dialog's ordinary Save/Cancel boundary. The section must be assigned the activity first. Hidden groupings remain eligible exception targets.

## Precedence and fields

Resolve each setting independently: **General → section override → matching team exceptions → student exception**. Teachers order team exceptions with the highest priority first. When several matching teams replace the same setting, the first wins; unchecked settings continue inheriting from lower-priority rules. An individual's selected setting always wins over teams, regardless of list position. Explicit null dates/time limits and false switches are replacements, not inheritance.

Every section override is also available on an exception:

| Override | Behavior |
| --- | --- |
| Available from / until | Replace or clear either assignment date. |
| Time limit | Replace minutes or disable timing. |
| Visibility | Replace activity visibility; a hidden ancestor folder still hides its descendants. |
| Safe Exam Browser | Require or waive SEB for summative work. |
| Grade challenges | Permit or prevent new challenges on released summative grades/feedback. |
| Points possible | Set the normalized grading scale. |
| Grading | Points or pass/fail, including its threshold and denominator. |
| Attempts | Unlimited, until due, or a maximum count. |
| Grade strategy | Latest, first, best, or weighted average with optional drop-lowest. |

The last six categories are summative-only. Switching to formative removes their override selections from both section and exception settings. Assessment mode remains General-only, and folder placement remains controlled by the content tree. Grade release, late grace, activity configuration, and Test child authoring are not exception fields because they are not section overrides in this dialog.

Targets are section-local: exactly one team or student enrollment per exception, at most one exception per target per assignment. Team membership is resolved at use time, including memberships in hidden groupings. Moving into/out of a team changes future policy resolution without copying settings onto students. Pending student enrollments may receive exceptions; teachers and TAs cannot be student targets.

## Enforcement and academic history

Core resolves policy for learner content visibility, assigned-activity detail and plugin access, availability/SEB checks, attempt limits, due-date lateness, grading normalization/selection, manual-grade defaults, regrading, student grade reports, and challenge creation. Manager Student view uses the section policy rather than impersonating an arbitrary student. Learner responses expose their effective values, never the exception list or its private team/student targets.

An attempt snapshots its time limit when it starts. Later team, student, or section edits do not extend or shorten that active deadline, including a compound Test's parent snapshot. Other access controls still apply on each request. Exception edits do not rewrite historical grades or grading events automatically; subsequent grading/regrading uses the current effective policy. Explicit teacher-entered grade overrides retain their supplied score/maximum. Existing challenge records survive disabling new challenges.

Settings saves validate the final availability window for every currently affected participant; an empty team's window is validated against the section policy. An invalid window or target rejects the complete transaction, including General edits. Subsequent membership changes do not rewrite or prevalidate activity rules; normal access checks continue enforcing the resulting dates.

## API and persistence

`GET /api/courses/:courseId/activities/:activityId/assign-all-groups` returns each section's `students`, `teams` (including grouping titles), and ordered `exceptions` alongside the existing assignment settings. It remains course-management-only. Roster permission alone does not grant activity-settings access.

The existing POST accepts `groupAssignments[].exceptions`. Each entry uses `teamId` or `participantId`, `overrideFields`, and the same values as a section override. The array is ordered highest-priority first for teams. Omitting `exceptions` preserves existing rules for older clients; sending `[]` removes them. Values for unchecked fields may be retained for editing, but never affect policy. Formative-mode pruning still applies when an older client omits exceptions.

`ActivityAssignmentException` stores assignment/target foreign keys, array-derived priority, and validated JSON settings. Unique constraints prevent duplicate targets; database checks enforce exactly one target and nonnegative priority. Core verifies that targets belong to the assigned section and are students. Saves replace the assignment's exceptions and append `activity_assignment_exceptions_updated` audit snapshots in the same transaction as assignment, content visibility, and gradebook updates.

Deleting a team/grouping removes its team exceptions. Unenrollment removes individual exceptions and team memberships. Unassignment, activity deletion, and section deletion cascade their exception rows; moving a deleted section's roster does not transfer rules. Renaming a team preserves its rules through the stable team ID. Duplicating an activity creates an unassigned draft and does not copy exceptions. These rules customize individual execution; they do not implement shared team submissions.

Migration `202610120004_activity_assignment_exceptions` is additive and leaves existing assignment/grade data unchanged. Apply with `npm run db:migrate:all`, regenerate Prisma clients, and restart running API processes before exercising the new relation. The standard deployment migration/backup workflow remains unchanged.

## Verification

- `packages/contracts/src/activity-assignment-exceptions.test.ts`: target cardinality, duplicate targets, and bounded inputs.
- `packages/core/src/activity-assignment-exceptions.test.ts`: field-level priority, participant/assignment isolation, student precedence, explicit null/false, all override categories, formative restrictions, and invalid stored settings.
- `packages/core/src/gradebook.test.ts`: effective attempt limits and due-date inheritance through team and student rules.
- `tests/e2e/activity-exceptions.spec.ts`: real editor Save/Cancel/reorder/reopen, desktop/mobile layout, active deadline preservation, all ten override fields, learner access and grading, private targets, membership changes, cleared dates, atomic rejection, legacy omission, formative pruning, and deletion cascades.

The browser scenarios belong to `@regression` and use disposable MCQ fixtures with real API/database integration, without AI or sandbox runners. See [browser test instructions](../tests/e2e/README.md) and [student groupings](STUDENT_GROUPINGS.md).
