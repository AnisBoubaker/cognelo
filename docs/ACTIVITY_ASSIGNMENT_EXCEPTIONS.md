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

Targets are section-local: exactly one team or student enrollment per exception, at most one exception per target per assignment. Team membership is resolved at use time, including memberships in hidden groupings. Moving into/out of a team changes live policy resolution without copying settings onto students. Pending student enrollments may receive exceptions; teachers and TAs cannot be student targets.

## Enforcement and academic history

Core resolves policy for learner content visibility, assigned-activity detail and plugin access, availability/SEB checks, attempt limits, due-date lateness, grading normalization/selection, manual-grade defaults, regrading, student grade reports, and challenge creation. Manager Student view uses the section policy rather than impersonating an arbitrary student. Learner responses expose their effective values, never the exception list or its private team/student targets.

Unsubmitted attempts resolve their effective settings live, including a compound Test parent. A deadline is the original start plus the latest effective total minutes: increasing the limit extends it, reducing it may expire it immediately, and disabling it removes the countdown. Standalone and compound Test countdowns share a fixed `hh:mm:ss` display, including zero-padded hours below one hour (for example, `00:05:09` or `02:15:00`). The initial limit/manifest remains unchanged and submission records `submittedTimeLimitMinutes` separately; later settings edits do not alter submitted attempt timing. Other access controls apply on each request. Exception edits do not rewrite historical grades or grading events automatically; subsequent grading/regrading uses the current effective policy. Explicit teacher-entered grade overrides retain their supplied score/maximum. Existing challenge records survive disabling new challenges.

Settings saves validate the final availability window for every currently affected participant; an empty team's window is validated against the section policy. An invalid window or target rejects the complete transaction, including General edits. Subsequent membership changes do not rewrite or prevalidate activity rules; normal access checks continue enforcing the resulting dates.

## Live updates and teacher notices

Assigned learner pages refresh policy every 20 seconds and on focus, including pages blocked by an attempt limit. Added attempts become available without reloading. The host refreshes access, visibility, SEB, and standalone attempt availability/timing; the Test runtime refreshes its timing and availability while retaining child item objects so unsaved answers are not replaced. Ordinary writes always resolve current server policy. A newly timed standalone activity still requires its explicit start if there is no started core attempt.

At zero the standalone host rechecks the server deadline before requesting the ordinary plugin submission. Core timeout finalization rejects a deadline that was extended or disabled. Automatic compound Test submission sends `onlyIfExpired`; the route checks live timing before claiming submission or running child graders and returns the still-active runtime if time remains. An already accepted final submission continues through its existing finalization path. There is no scheduled server submission at the exact deadline.

When a settings save finds answering students (the activity messenger's 45-second presence window, excluding completed/deleted attempts), it returns `ACTIVITY_SETTINGS_ACTIVE_STUDENTS` with the active count before changing data. The teacher can cancel, apply without a notice, or enter an optional message for all currently answering students in the save's activity/section scope. Presence and this warning remain active when messaging is disabled. Optional notices require the resulting activity-level [messaging setting](ACTIVITY_MESSAGING.md) to be enabled (enabling can include a notice; disabling cannot). Notices retain existing teacher messaging permissions; the warning returns `canNotifyStudents`, and a course designer without that scope gets confirmation without a message field. Confirmation uses `confirmActiveStudents`; `studentMessage` is trimmed and limited to 4,000 characters. The settings change and in-app broadcast share one database transaction. Invalid settings roll back the message too. This does not send email. Students can still read their own stored conversation when a live availability/visibility/SEB change closes activity access; reading that history does not renew answering presence.

Live assignment policy does not unlock Test composition, child questions, plugin-private authoring, or historical grading evidence. Those authoring locks and explicit regrading/conversion workflows retain their existing behavior.

## API and persistence

`GET /api/courses/:courseId/activities/:activityId/assign-all-groups` returns each section's `students`, `teams` (including grouping titles), and ordered `exceptions` alongside the existing assignment settings. It remains course-management-only. Roster permission alone does not grant activity-settings access.

The existing POST accepts `groupAssignments[].exceptions`. Each entry uses `teamId` or `participantId`, `overrideFields`, and the same values as a section override. The array is ordered highest-priority first for teams. Omitting `exceptions` preserves existing rules for older clients; sending `[]` removes them. Values for unchecked fields may be retained for editing, but never affect policy. Formative-mode pruning still applies when an older client omits exceptions.

`ActivityAssignmentException` stores assignment/target foreign keys, array-derived priority, and validated JSON settings. Unique constraints prevent duplicate targets; database checks enforce exactly one target and nonnegative priority. Core verifies that targets belong to the assigned section and are students. Saves replace the assignment's exceptions and append `activity_assignment_exceptions_updated` audit snapshots in the same transaction as assignment, content visibility, and gradebook updates.

Deleting a team/grouping removes its team exceptions. Unenrollment removes individual exceptions and team memberships. Unassignment, activity deletion, and section deletion cascade their exception rows; moving a deleted section's roster does not transfer rules. Renaming a team preserves its rules through the stable team ID. Duplicating an activity creates an unassigned draft and does not copy exceptions. These rules customize individual execution; they do not implement shared team submissions.

Migration `202610120004_activity_assignment_exceptions` is additive and leaves existing assignment/grade data unchanged. Apply with `npm run db:migrate:all`, regenerate Prisma clients, and restart running API processes before exercising the new relation. The standard deployment migration/backup workflow remains unchanged.

## Verification

- `packages/contracts/src/activity-assignment-exceptions.test.ts`: target cardinality, duplicate targets, and bounded inputs.
- `packages/core/src/activity-assignment-exceptions.test.ts`: field-level priority, participant/assignment isolation, student precedence, explicit null/false, all override categories, formative restrictions, and invalid stored settings.
- `packages/core/src/activity-timing.test.ts`, `test-execution.test.ts`, and `activity-settings-live.test.ts`: live deadline changes, stale expiry protection, and confirmation/message boundaries.
- `tests/e2e/live-test-settings.spec.ts`: compound runtime refresh, stale automatic submission, and submitted timing preservation.
- `packages/core/src/gradebook.test.ts`: effective attempt limits and due-date inheritance through team and student rules.
- `tests/e2e/activity-exceptions.spec.ts`: real editor Save/Cancel/reorder/reopen, desktop/mobile layout, live deadlines, optional notices and cancellation, draft preservation, extra-attempt refresh, submitted timing preservation, all ten override fields, learner access and grading, private targets, membership changes, cleared dates, atomic rejection, legacy omission, formative pruning, and deletion cascades.

The browser scenarios belong to `@regression` and use disposable MCQ fixtures with real API/database integration, without AI or sandbox runners. See [browser test instructions](../tests/e2e/README.md) and [student groupings](STUDENT_GROUPINGS.md).

## Reopened submissions

[Reopening the last submission](SUBMISSION_CONTINUATION.md) preserves its original start but resolves the current effective policy again. Extensions or team/student exceptions added after submission apply to the resumed work, including on compound Tests; reopening itself never adds time or changes assignment settings.
