# Parsons Detailed Reference

This document is the detailed reference for the Parsons plugin.

Platform-wide architecture belongs in the root [README.md](../../../../README.md).

## Purpose

`@cognelo/plugin-parsons` provides the `parsons-problem` activity type for programming education.

Teachers can:

- define the prompt
- author a reference solution
- choose the display language
- strip indentation from the student version
- create line groups directly from the editor gutter
- mark groups as strict or flexible
- add precedence rules between groups
- generate a prompt and solution with AI while using selected skills, suggesting catalog skills, or ignoring knowledge links

Students can:

- reorder scrambled lines
- restore indentation when required
- use click-to-select plus arrow-key movement
- resume persisted attempts
- confirm standalone summative submission before it is recorded, then return to the course content page

## Package Contents

```text
src/
  attempt-types.ts          Shared Parsons attempt schemas/types
  attempts.ts               Persistence logic for Parsons attempts
  db.ts                     Plugin DB manifest
  index.ts                  Public plugin exports
  messages.ts               Plugin-local i18n strings
  parsons.ts                Runtime/config/parsing/evaluation helpers
  plugin.ts                 Activity plugin definition and config schema
  routes.ts                 Plugin-owned server subroutes
  server.ts                 Server plugin exports
  web/
    parsons-activity-view.tsx
                            Plugin-owned web UI
```

## Activity Type

- `parsons-problem`

The activity config currently includes:

- `prompt`
- `solution`
- `language`
- `stripIndentation`
- `groups`
- `precedenceRules`

## Persistence

Core applies [team and student assignment exceptions](../../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md) to access, timing, attempts, grading, and challenge policy. Plugin routes consume the resolved assignment and core grade services; unsubmitted attempt deadlines resolve the latest effective limit from the original start, and the host refreshes policy every 20 seconds. Submitted timing stays fixed.

Parsons owns plugin-specific persistence for student attempts.

Authored Parsons content remains in generic activity config, so explicit course/bank synchronization is core-owned and needs no private authoring hook. Any existing core attempt prevents bank-to-course retrieval, while course-to-bank publication remains allowed because it does not replace attempted course content.

The shared bank-version visualizer can therefore compare the complete Parsons authoring configuration without a plugin-specific diff.

Parsons versions are publication milestones: draft saves create no version, while changed Published saves create the next immutable snapshot.

The activity definition uses the semantic `tornado` icon name, rendered by the platform's shared Tabler icon layer.

Current plugin-owned tables:

- `PluginParsonsAttempt`
- `PluginParsonsAttemptEvent`

These tables are modeled in this plugin's local Prisma schema under `prisma/schema.prisma`; attempt services use the plugin-local Prisma client from `src/db-client.ts`.

Key behavior:

- students get a persisted in-progress attempt
- reload restores saved block order, indentation, selected block, and last evaluation snapshot
- correct completion closes the current attempt
- the next fresh try starts a new attempt
- teacher/admin previews stay ephemeral so instructor exploration does not pollute student-behavior data

Course activity settings may add a time limit in either assessment mode. Core owns the explicit start and live deadline. Parsons move/state updates are rejected after expiry, while the route's final check/submission remains available for the host's automatic zero-time submission. The renderer answers `TimedActivityAutoSubmit` by invoking its normal submission function, which links the current plugin attempt to the already-started core timed attempt rather than creating another one.

## Routes

Parsons owns its own plugin subroute definitions in `src/routes.ts`.

Current subroutes:

```text
POST   /api/courses/:courseId/activities/:activityId/parsons/attempt
PATCH  /api/courses/:courseId/activities/:activityId/parsons/attempt
POST   /api/courses/:courseId/activities/:activityId/parsons/generate
GET    /api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/parsons/gradebook-attempts
```

These are also available through group-scoped assigned activity dispatch for student work. They are mounted through the platform’s generic plugin dispatchers, not through Parsons-specific files in `apps/api`.

Every knowledge mode provides the complete subject catalog to the generation model as a curriculum boundary. `Use selected skills` additionally constrains the generated problem with the current draft selection. `Suggest skills` ignores the old selection and applies exact subject-catalog matches to the unsaved Concepts-tab draft after generation. `Ignore skills` neither reads nor changes the draft and performs no suggestion pass.

From an activity bank, **Create variation** operates on an independent duplicate and passes the preserved concept selection as a required generation target. The new prompt and solution must remain at comparable difficulty and use the same programming language, but must change more than names or context. Generation also requires the exact original physical and non-empty solution line counts and receives the copied grouping structure as a constraint; this keeps group ranges and precedence rules valid without weakening the authored interaction. Reusable Test variation invokes the same handler per Parsons child.

Standalone AI generation is covered by the shared non-dismissible progress dialog with an indeterminate bar because the model call has no trustworthy intermediate percentage. Activity-bank variation continues to report the background job's actual progress across child activities.

The gradebook attempts route is teacher-only. It returns a participant's completed Parsons submissions by default, can include in-progress/abandoned attempts plus event history with `includeAttempts=true`, and can be constrained to one exact participant-owned plugin attempt with `attemptId`; the course gradebook detailed-results page uses it for the Parsons **Review and grade** overlay. That overlay loads the newest current-mode core reference first and requests older plugin payloads only when the teacher navigates; historical and formative attempts are read-only. Each formative check and summative submission also creates a core attempt linked to the plugin attempt and tagged with the assignment mode. Core mode references keep old formative work inspectable after a switch to summative without admitting it into summative grading.

Parsons registers a server `gradeAttempt` handler for the platform gradebook regrade API. Teacher-triggered regrades resolve the stored plugin attempt reference, evaluate the submitted attempt state against the current course-local activity config, and let the core gradebook service record the updated grade plus a `regraded` audit event.

Summative submissions do not show correctness feedback during the activity. When the gradebook item is released, Parsons provides sanitized deterministic student feedback through the core normalized grade result: the same order/indentation messages used by formative checks plus an order/indentation grading breakdown. This does not expose raw plugin payloads, attempt history, or grading timestamps to students. When the effective summative assignment setting enables challenges, the released deterministic or teacher-overridden grade is challengeable through core, which reopens the existing Parsons **Review and grade** surface for any change.

## UX Notes

Previous submissions are available before the next timed start. When mounted in history mode, load submitted records without ensuring an answering attempt. Returning to New attempt keeps the explicit start gate.

The compound Test adapter persists the optional `hasAnswer` field in generic item state: initialization/reset sets it false and a move/indent sets it true. The state schema preserves this marker through grading and reopening. `hasParsonsAnswer` reads it without evaluating order or indentation. Pre-marker drafts with saved blocks count as answered because their earlier interaction history is unavailable. The final review itself never checks correctness.

Course Student view injects an ephemeral attempts client backed by browser session storage. Checks and submission use the pure evaluator and never create plugin attempts or movement/research events.

Learner movement/reset controls stay disabled until the saved arrangement finishes loading, preventing initialization from overwriting an immediate edit or the final Test review from reading before that edit reaches its save queue.

- student rows render in a compact editor-like style
- syntax highlighting and line numbers come from shared `@cognelo/activity-ui`
- teacher authoring is registered with the shared `useUnsavedChangesGuard`; future Parsons authoring/settings forms should register the same dirty/save/discard behavior
- scrambling is random on each fresh try/reset
- order feedback counts minimally misplaced units instead of cascading false counts
- groups are stored as line ranges so edits inside a group keep the group coherent
- teacher authoring uses the shared responsive `EditActionBar` for saved/unsaved status and snapshot-backed Cancel/Save actions
- standalone summative submission uses a confirmation dialog; cancelling keeps the arrangement editable, while a successful confirmation records the attempt before navigating back to course content

## Contributor Workflow

Standalone activity **Class overview** loads each participant's latest completed attempt and shows the reference solution, an error-count distribution, and a grade distribution. Hovering a bar identifies the students in that bucket.

When changing this plugin, update this detailed reference, the package README if its overview or routing changed, and `PROJECT_MEMORY.md` only when a durable invariant changed. Update root documents only for platform-wide contracts.

## Reopening the last submission

Restores the submitted arrangement on its existing plugin attempt, reopens it, and clears completion/evaluation state after archiving prior state/results. Existing interaction events are retained; ordinary resubmission reuses the core attempt. The shared [continuation service](../../../../docs/SUBMISSION_CONTINUATION.md) enforces latest-attempt and staff scope, archives prior evidence, preserves attempt identity and original start, and applies current General/section/team/student settings. Later extensions or individual exceptions therefore affect the resumed deadline without resetting it.


## Live authoring and grade visibility

The learner prompt and rules refresh without replacing the current arrangement. Configuration changes reconcile existing blocks, update the same active attempt rather than abandon it, and append new lines. Standalone submission/check evaluation is computed on the server against the current solution; client-provided correctness is not authoritative. Summative attempt/history payloads remove evaluation until release, and `studentResponseState` always removes legacy embedded evaluation from composite drafts.

Shared confirmation, submitted-Test snapshots, and concurrency are documented in [Live activity authoring](../../../../docs/LIVE_ACTIVITY_AUTHORING.md).


## Explicit solution release

This type supports the shared [Solution tab](../../../../docs/ACTIVITY_SOLUTIONS.md). Course settings must opt in; summative work additionally requires grade release. The learner first sees encouragement to try independently and must press **Show solution**. The same provider serves this type inside a Test under the parent switch. See the linked reference for formats, live revocation, API boundaries, and current-reference semantics.

## Test automatic regrading

The core [Test regrading batch](../../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading) reevaluates every submitted child against current grading rules, including previously graded work. Individual and whole-class actions show measured progress. Saved answers, original timing, submitted composition/point weights, and grade-release state remain fixed. Each successful rerun is audited; an individual failure does not stop later exercises, and an incomplete batch leaves the parent total unchanged. Recovery may initially preserve responses without a grade or runner artifact; later teacher regrading uses the same batch. No AI feedback is requested automatically. Standalone behavior is unchanged.

The composite regrade handler reconciles the original response against current authoring only for evaluation. It returns the original answer state; core retains its original config snapshot and records the grading configuration separately, so reordered choices or edited lines cannot rewrite submitted answers or break historical review.

### Timestamp display

Submission, review, and other dated UI records use the shared effective course timezone: the administrator’s application default unless a course owner has selected an allowed override. Stored instants remain UTC; plugin UI must not infer a timezone from the learner device. See [Application time](../../../../docs/APPLICATION_TIME.md) for the shared context and clock/security contract.

## Restricted student review

The optional [core content-closure policy](../../../../docs/ACTIVITY_CONTENT_ACCESS.md) governs learner retrieval after permitted attempts end, including compound Test children. Shared dispatch denies closed content/history/file reads and returns only a closure signal after the final submission; teacher inspection and stored evidence remain intact. Released grades do not authorize detailed reports or solutions while closed.

## Shared action controls

Teacher, learner, and settings actions follow the platform [button and icon contract](../../../../docs/ACTION_BUTTONS.md). Use explicit semantic `ActionIcon` names with localized labels; dimensions and interaction colors are shared CSS, while tabs, disclosure rows, and specialized editor controls retain their own layout.
