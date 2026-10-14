# Reopening a student's last submission

From an activity's **Student results** tab or the equivalent detailed gradebook, an authorized grader can choose **Reopen last submission** in the student's action menu. The shared confirmation can be cancelled. The action is available only when the latest non-deleted attempt is submitted or graded in the assignment's current assessment mode; it is unavailable for a student who never submitted, an already open attempt, or an older submission with newer work.

## Timing and policy

Reopening returns the same core attempt to `started`, with the same ID, attempt number, original `startedAt`, authored version/fingerprint, and Test manifest. It does not grant another attempt, reset the start time, change assignment settings, or add time.

The resumed work uses **current effective settings**, including edits made since submission: General → section → prioritized team → student, independently per field. For a timed attempt, the deadline is the earlier of the original start plus the current effective limit and the current effective Until date. The previous submission’s duration/Until snapshots are archived and cleared when reopening. A general extension or a student-specific exception therefore applies immediately on reopening. An expired effective deadline remains expired; availability, visibility, and Safe Exam Browser requirements still apply normally. Subsequent settings changes continue to refresh within 20 seconds.

The action explicitly permits continuing this attempt even when its consumed attempt slot or previously released grade would otherwise block starting new work. The item-wide release setting and all other learners remain unchanged. A reopened Test permits resuming this sitting across browser sessions even when its authored `allowResume` setting is false; the manifest itself remains unchanged. Ordinary subsequent attempts retain the usual release and resume rules.

## Answers, grades, and audit

- MCQ restores submitted choices into the standalone response draft.
- Programming Exercises and Web Design restore source code/files from the exact learner-owned submission; existing execution and grading artifacts stay immutable.
- Parsons restores the submitted arrangement and clears its completion/evaluation state. Prior state and result summaries are archived; existing interaction events remain.
- Coding Homework keeps the uploaded files and generated questions, reopens their saved answers, and submits them again through the same core attempt. It does not rerun ZIP analysis or regenerate questions.
- A compound Test reopens all existing item attempts together, retains their response state and original starts, clears current item scores/feedback and its completed submission claim, and reruns ordinary child finalization on resubmission.
- Core clears completion timestamps, duration, lateness, final timing metadata, and current teacher feedback. Original values, child results, plugin continuation evidence, the previous grade, and the staff actor are retained in an append-only `submission_reopened` GradeEvent.
- The reopened submission stops contributing to grades. Core recomputes from remaining completed submissions under current grading policy, or deactivates the selected grade when none remain, including an overridden grade. Historical grade events remain available, but events before reopening cannot resurrect that submission's old result during later selection.
- Resubmission uses the same attempt slot and calculates completion time, duration, lateness, grading, and submitted effective time limit and Until snapshot afresh. As with any submitted work, its final timing then stays fixed until explicitly reopened again.

## API and plugin boundary

`POST /api/courses/:courseId/gradebook/attempts/:attemptId/reopen` uses the existing course/section grading authorization and cookie Origin protection. Unknown/cross-course attempts fail closed. Repeated requests, older attempts, mismatched assessment modes, and Tests still processing final submission are rejected with a conflict.

The mutation runs in a serializable transaction. Plugin restoration, core drafts, Test children, grade changes, and the audit event commit together. Concurrent changes produce a conflict rather than partially reopening a submission.

Plugins register `ServerActivityPlugin.attemptContinuation` with explicit `activityTypeKeys` and a `reopen` handler. The handler receives exact activity/learner/artifact identities and a parameterized tagged-template transaction interface. Plugin-owned SQL remains inside the plugin; neither core nor the SDK imports a plugin model/client. Return only learner response state for the generic draft and bounded prior mutable state for the audit. Never return private tests, solutions, prompts, or credentials as response state. Restore against the supplied transaction; do not perform remote work or independently commit plugin changes. Missing artifacts reject the operation. Core handles Tests directly and preserves any generic timeout response when the plugin has no finalized artifact.

Migration `202610120005_reopen_submission` adds the enum value idempotently. Deploy through `npm run db:migrate:all` before serving the new mutation; there is no data rewrite.

## Verification

Core tests cover original timing, state restoration, grade withdrawal and audit snapshots, section scope, cross-course and lifecycle rejection, historical modes, missing artifacts, and compound submission claims. Browser coverage exercises the action and cancellation from both report entry points, student rejection, restored editable answers, unchanged attempt identity/count, resubmission, post-submission general extensions and student exceptions, and compound Test continuation. The activity-type journeys also reopen and resubmit Parsons, Programming Exercises, Web Design, and Coding Homework using their ordinary learner workflows.

Verified locally on 2026-10-12:

- `npm test`: 1,204 tests passed in 251 files; plugin boundary checks passed.
- `npm run typecheck`: passed across all workspaces. The two changed E2E specifications also passed a separate strict TypeScript check.
- `npm run lint`: no errors; 47 existing warnings.
- `npm run test:e2e`: 131 passed, one existing content-resource duplication/visibility test failed, and its three dependent tests did not run. All five new continuation scenarios and all extended plugin journeys passed.
- `npm run test:e2e -- tests/e2e/content-resources.spec.ts`: all four passed without changes. All 135 scenarios passed across these runs; the initial content-resource failure remains intermittent and was not resolved by this change.
- `npm run db:migrate:all`: the additive migration applied and database clients regenerated successfully.

Documentation review covered the root README, project memory, architecture, documentation index, gradebook/Test plans, assignment-exception reference, platform reference, plugin authoring contract, and each affected answering plugin's README, project memory, and canonical reference. The root README's existing navigation remains current. Continuation documentation links were checked; no affected documentation remains unverified.
