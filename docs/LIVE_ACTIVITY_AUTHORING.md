# Live activity authoring

Teachers may edit course questions, including questions inside an already-started compound Test. Prompts/descriptions, answer keys, visible/private grading tests, points, order, and composition apply to unsubmitted attempts. Learner pages refresh every 20 seconds and on focus. The editors retain typed code, files, choices, and arrangements; MCQ and Parsons use plugin-owned response reconciliation when the authored structure changes.

## Confirmation and audit

`withActivityAuthoringChange` authorizes the manager and resolves a child to its parent Test. The ordinary active-student confirmation uses the messenger's 45-second presence window. Teachers can cancel, apply without a notice, or send an optional in-app message when activity messaging and their messaging scope permit it. No email is sent. The shared progress dialog yields to this confirmation so a validating save cannot obscure the decision.

Each accepted mutation appends an actor-attributed `CourseAuditEvent` in its write transaction. Public edits retain before/after authored snapshots; composition uses `test_item_added`, `test_item_updated`, and `test_item_removed`. Programming/Web Design private edits use `activity_private_content_updated`: core stores opaque fingerprints, while the owning plugin stores complete private before/after snapshots in its `AuthoringRevision` table using the same transaction. These private revision tables are registered for plugin backup and removed by course-activity deletion hooks; copies do not inherit another activity's audit trail.

The form's public save and a plugin's private save remain separate requests. Successful public confirmation is carried to the following private save to avoid a second warning/notice. Each mutation and its audit/optional message are individually transactional. Programming test validation still runs before persistence and accepts signed preflight receipts.

## Compound attempt consistency

An initial immutable `TestRevision` and manifest record the start. Active runtime content comes from current, non-removed items and effective settings. Original randomized ordering is retained for surviving items, with additions appended; ordinary ordering follows the teacher. Removing a question sets `TestItem.removedAt`, retaining its owned activity, private data, and historical responses. Whole-Test duplication/publication uses active items; whole-Test deletion includes removed children.

The final submission claims the attempt under the same parent advisory lock used by authoring. Authoring returns `TEST_SUBMISSION_IN_PROGRESS` while graders run; retry the save after completion. The submit route reloads current content after claiming, grades current saved responses against current answer keys/private tests, and records a final revision plus `submissionManifest`. Previously graded children from an interrupted submission are reopened after an edit, with their prior evidence archived, so retries cannot reuse obsolete grades.

Submitted Test history uses its final revision, ordering, points, and timing. Later edits affect active/future work, not completed grades; teacher regrading remains explicit. Content changes while the student is on the final review dismiss its stale confirmation and return to the exercises. Autosaves carry the displayed configuration snapshot so choices made before the next refresh can still be reconciled correctly.

## Submission and grade visibility

Programming Exercises with no enabled hidden tests still submit, including blank responses in a Test. The execution records `accepted: null` and `gradingPending: true`; no score is invented. The core child/standalone attempt remains submitted, and a Test containing such a child finalizes as submitted pending grading. Existing release checks reject submitted-ungraded work. A configured language/runner discovery is still required by the programming execution path.

Summative learner submission/status/history APIs suppress scores, grading summaries, correctness, and private test outcomes until core confirms grade release. Practice sample runs retain their normal feedback. Composite draft endpoints always project student-safe state; Parsons removes embedded evaluation even from legacy state. Released reports and teacher review continue through their existing authorized channels.

## Contracts and migrations

- `ActivityDefinition.reconcileResponseState` is a pure plugin hook for response identity after edits; `studentResponseState` removes grading evidence from generic learner state.
- Composite submission may return `gradingResult: null`, meaning successfully submitted but awaiting grading.
- Core migration `202610130001_live_test_items` adds nullable `TestItem.removedAt`.
- Programming and Web Design each register `202610130010_authoring_revisions` in their `src/db.ts` migration descriptors. Run `npm run db:migrate:all` and `npm run db:generate` before starting the updated apps.
- Regression coverage: `activity-authoring-live.test.ts`, `student-grade-visibility.test.ts`, plugin persistence/route tests, and `tests/e2e/live-test-content.spec.ts`. The coding scenarios require the configured Judge0 service.
