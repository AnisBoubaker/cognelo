# Gradebook Implementation Plan

This document records the agreed gradebook/grading design direction before implementation.
It is intentionally a planning artifact. Implementation should proceed iteratively and update this file whenever the model, plugin contract, UI behavior, or rollout order changes.

## Goals

- Add a course gradebook that aggregates graded work across course groups/sections.
- Keep the graded unit tied to the group assignment so grades, attempts, analytics, and future research exports remain group-scoped.
- Support plugin-provided grading while keeping normalized gradebook records in core.
- Preserve all attempts and grade changes for analytics, research, and auditability.
- Let teachers configure attempt and grading behavior per assigned group activity.

## Agreed Decisions

### Core Model

- A gradebook item represents one assigned group activity.
- Gradebook items belong to a course group through the assigned `CourseGroupActivity`.
- Course-level gradebook views aggregate gradebook items across groups.
- Grades attach to a `CourseGroupParticipant`, with optional linked `User` for participants who have activated their account.
- This matches the current enrollment model where participants can exist before platform users.

### Attempts

- Core owns shared attempt metadata in an `ActivityAttempt` table.
- Plugins own plugin-specific attempt state, submissions, artifacts, events, and grading internals.
- Attempt lifecycle is:
  - `started`
  - `submitted`
  - `graded`
- Only activities/plugins that opt in support attempts.
- Attempt policy is teacher-configurable per assigned activity:
  - unlimited attempts
  - maximum attempts
  - retry until due date
- Grade selection strategy is teacher-configurable:
  - latest
  - best
  - first
  - weighted average
- Weighted average uses equal attempt weight.
- For weighted-average grading, teachers may choose to drop the lowest attempt when there is more than one attempt.

### Grades

- Plugins return numeric raw grading results.
- Core normalizes raw plugin scores into the teacher-selected gradebook scale.
- Teacher can configure an activity as:
  - points-based, for example raw `15/15` normalized to gradebook `100/100`
  - pass/fail, with a teacher-defined pass threshold, for example pass at `50/100`
- Core stores both:
  - raw plugin grading result
  - normalized gradebook score/result
- There is no standalone grade status enum.
- A grade exists when an attempt has been graded automatically or manually.
- Manual grading and override UI is provided by the plugin because it must show plugin-specific attempt details.
- Grade changes create an audit trail.

### Submission And Grading

- Group activity assignments have an assessment mode:
  - formative activity
  - summative activity
- Formative activity checks are recorded by the plugin for analytics/research, but they do not create core submissions or gradebook grades.
- Summative activity submissions create core attempts, submissions, and grades when the plugin can grade immediately.
- Every submission creates an attempt.
- An attempt should not remain submitted without grading.
- Teachers can manually grade or override automatic grades.
- Teachers can regrade after tests/rubrics/reference answers change.
- Regrading preserves old grade records for audit and research.
- Plugin grading returns a result; core records attempts, grades, normalized scores, and audit events consistently.
- Manual-only activities may have `ActivityAttempt.lifecycle = submitted` without a `Grade` row while awaiting teacher grading.
- The gradebook computes "needs grading" from submitted attempts that do not yet have a grade.

### Availability, Due Dates, And Release

- `CourseGroupActivity.availableUntil` is the lateness boundary.
- Teachers can allow late submissions.
- Late submissions are marked as late.
- Teachers can configure late penalties:
  - percentage penalty
  - penalty interval, for example per hour
  - maximum penalty below 100%
  - optional grace period
- Late penalties apply by completed penalty periods after `availableUntil`, up to the configured maximum penalty.
- Grades can be hidden from students.
- Grade visibility can be:
  - shown immediately
  - hidden until teacher releases them
- Grade release is controlled per gradebook item.

### Plugin Contract

Plugins declare grading/attempt capability in registry metadata.

Initial capability metadata should include:

- `supportsAttempts`
- `supportsAutoGrading`
- `supportsManualGrading`
- `defaultMaxAttempts`
- likely later: `supportsFeedback`, `supportsRegrading`, `supportsAnalyticsEvents`

Plugin responsibilities:

- attempt creation handler, where relevant
- submit handler
- grading handler
- manual grading UI
- future feedback renderer
- analytics event payloads
- immutable plugin-specific artifacts such as submitted code, test results, rubric data, screenshots, files, or event traces

Core responsibilities:

- validate assignment/student/course context
- enforce attempt policy
- compute lateness and penalties
- normalize grades
- select the gradebook-counting attempt
- store core attempt records
- store current gradebook grade
- store grade/audit history
- provide gradebook queries and exports

Parsons initial grading behavior:

- Formative Parsons activities keep the existing "Check answer" workflow and record check events in the plugin attempt tables.
- Summative Parsons activities show a student "Submit" action. Submitting records the Parsons result, creates a core `ActivityAttempt`, submits it, and records an automatic grade.
- The initial Parsons raw grade is `1/1` when order and indentation are both correct.
- Partial Parsons credit currently gives `0.7` for correct order and `0.3` for correct indentation.
- The next Parsons grading-settings slice should let teachers choose all-or-nothing vs partial credit, adjust order/indentation weights, and decide whether formative feedback is shown before summative submission.

### Gradebook UI

Teachers see:

- course-wide gradebook table by group, participant, and activity
- group/section gradebook
- activity submissions view
- individual student history
- filters for group, activity, missing, late, and needs grading
- CSV export
- later LMS-compatible export

Students see:

- their own released grades and feedback
- no hidden test details
- no attempt history in the first version

TAs and group teachers:

- can grade where authorized for their group/course scope
- exact scope should follow existing group participant/course membership authorization rules

### Analytics And Research

Every attempt should record:

- timestamps
- duration
- attempt number
- activity version/config fingerprint
- plugin version
- grading result
- whether feedback was shown
- lateness data
- selected grade strategy outcome, when relevant

Immutable snapshots should include:

- prompt/config at attempt start, if the current course activity/version data is not enough
- tests/rubrics/reference data used for grading
- submitted student artifact

Privacy and research:

- exports are identifiable by default
- anonymized export should be available when requested
- external student ID support is required
- course-level research consent support is planned
- when a course is marked for research, the teacher-provided consent form appears at first course access

### Authorization

Can grade:

- course owner
- course teacher
- TA
- group teacher

Cannot grade:

- students
- teachers after course archive

Students:

- see score/feedback according to grade visibility settings
- never see hidden test details
- do not see attempt history initially

## Proposed Core Data Model

Names are provisional and should be validated during schema design.

### `GradebookItem`

One row per assigned group activity.

Likely fields:

- `id`
- `courseId`
- `groupId`
- `groupActivityId`
- `activityId`
- `titleSnapshot`
- `pointsPossible`
- `gradingMode`: `points` or `pass_fail`
- `passThresholdPoints`
- `passThresholdOutOf`
- `attemptLimitMode`: `unlimited`, `max_attempts`, `until_due`
- `maxAttempts`
- `gradeStrategy`: `latest`, `best`, `first`, `weighted_average`
- `dropLowestAttempt`
- `lateSubmissionsAllowed`
- `latePenaltyPercent`
- `latePenaltyIntervalMinutes`
- `latePenaltyMaxPercent`
- `lateGracePeriodMinutes`
- `gradesReleased`
- `metadata`
- `createdAt`
- `updatedAt`

Decision: use a separate `GradebookItem` table in the MVP. Do not store gradebook policy only in `CourseGroupActivity.metadata`.

### `ActivityAttempt`

Core attempt metadata.

Likely fields:

- `id`
- `courseId`
- `groupId`
- `groupActivityId`
- `activityId`
- `gradebookItemId`
- `participantId`
- `userId`
- `attemptNumber`
- `lifecycle`
- `startedAt`
- `submittedAt`
- `gradedAt`
- `durationSeconds`
- `isLate`
- `lateBySeconds`
- `activityVersionId`
- `activityConfigFingerprint`
- `pluginKey`
- `pluginVersion`
- `pluginAttemptRef`
- `metadata`
- `createdAt`
- `updatedAt`

### `Grade`

Current normalized grade for a participant on a gradebook item.

Likely fields:

- `id`
- `gradebookItemId`
- `participantId`
- `userId`
- `selectedAttemptId`
- `rawScore`
- `rawMaxScore`
- `normalizedScore`
- `normalizedMaxScore`
- `isPass`
- `latePenaltyApplied`
- `latePenaltyPercent`
- `gradedByUserId`
- `gradedAt`
- `source`: `auto`, `manual`, `override`, `regrade`
- `rawResult`
- `normalizedResult`
- `metadata`
- `createdAt`
- `updatedAt`

### `GradeEvent`

Append-only audit/research history.

Likely fields:

- `id`
- `gradeId`
- `gradebookItemId`
- `participantId`
- `attemptId`
- `actorUserId`
- `eventType`: `auto_graded`, `manual_graded`, `overridden`, `regraded`, `released`, `hidden`
- `previousValue`
- `nextValue`
- `reason`
- `metadata`
- `createdAt`

## Derived States Instead Of Grade Status

Because there is no grade status enum, gradebook UI should compute states from records:

- missing: participant has no submitted/graded attempt for the item
- late: selected or submitted attempt is late
- needs grading: at least one submitted attempt exists without a grade for an activity that requires manual grading or manual review
- graded: grade row exists
- hidden/released: controlled by gradebook item visibility/release settings, not grade status

## Resolved Design Details

### Manual-Only Grading

- `ActivityAttempt.lifecycle = submitted` is allowed without a `Grade` row.
- This represents pending manual grading.
- There is still no grade status enum.
- "Needs grading" is derived from submitted attempts without grades.

### Physical `GradebookItem` Table

- MVP should create a separate `GradebookItem` table.
- Do not store gradebook policy only in `CourseGroupActivity.metadata`.

### Weighted Average Strategy

- Weighted average uses equal weight per counted attempt.
- Teachers can choose to drop the lowest attempt.
- Dropping the lowest applies only when there is more than one attempt.

### Late Penalty Timing

- Penalties apply by completed late period after `availableUntil`.
- Example: if the penalty interval is one hour, the first penalty applies during the first late hour, the second after that interval is over, and so on.
- Penalties stop at the teacher-defined maximum penalty.
- Teachers may define a grace period.

### Grade Release Granularity

- Grade release is controlled per gradebook item.

### Existing Plugin Attempt Tables

- Existing development/plugin attempt and submission data does not need to be preserved.
- We can start fresh and update seed data as needed.
- Existing plugin schemas should be adapted going forward rather than backfilled.

### Research Consent First-Access Flow

- Consent form content is stored on the course.
- Consent form versioning is not required in the first implementation.
- Students can withdraw consent.
- Research exports must support filtering based on consent.

## Remaining Design Details

These are implementation details rather than product-level blockers:

- exact field names and enum names
- exact CSV column order
- exact gradebook table layout
- exact route naming

## Iterative Implementation Roadmap

### Phase 0: Finalize Design

- Validate this plan.
- Confirm exact schema field names and enum values.
- Confirm default gradebook item creation behavior when a group activity is assigned.

### Phase 1: Core Schema Foundation - Completed

- Completed: added core Prisma models for gradebook items, attempts, grades, and grade events.
- Completed: added enums for attempt lifecycle, grade source, grade strategy, attempt limit mode, and grading mode.
- Completed: added indexes for gradebook views:
  - course/group/activity
  - participant
  - gradebook item
  - attempt order
- Completed: added core migration `202605180001_gradebook_foundation`.
- Completed: added schema guard tests.

### Phase 2: Gradebook Item Lifecycle - Completed

- Completed: create gradebook items when activities are assigned to groups.
- Completed: handle course-wide all-groups assignments by creating one gradebook item per materialized `CourseGroupActivity`.
- Completed: preserve gradebook items when all-groups policy is removed.
- Completed: group activity assignment removal is handled by the `CourseGroupActivity` relation lifecycle.
- Deferred until grade editing services exist: block grade editing after course archive.

### Phase 3: Attempt Service Contract - Completed

- Completed: added core services to:
  - start attempt
  - submit attempt
  - record grading result
  - compute attempt number
  - enforce attempt limits
  - compute lateness
- Completed: added an activity SDK route-context helper plugins can call for assigned group activity attempts.
- Completed: added tests for attempt limits, late attempts, participant scoping, and grade event creation.

### Phase 4: Plugin Grading Contract - Completed

- Completed: extended activity plugin definitions with grading capability metadata.
- Completed: defined plugin grading result shape.
- Completed: defined plugin manual grading UI contract.
- Completed: defined plugin analytics payload contract.
- Completed: updated Parsons as the first integration target.

First plugin integration target:

- Parsons - completed.

### Phase 5: Grade Normalization And Selection - Completed

- Completed: implement normalization from raw plugin points to gradebook points.
- Completed: implement pass/fail calculation.
- Completed: implement grade selection strategies:
  - latest
  - best
  - first
  - weighted average
- Completed: implement late penalty application.
- Completed: store every grade change as `GradeEvent`.

### Phase 6: Teacher Gradebook UI - Completed

- Completed: add course-wide gradebook tab/page.
- Completed: add group/section gradebook view.
- Completed: add activity submissions view through the gradebook activity/status filters and per-activity rows.
- Completed: add participant history view through per-row attempt history summaries.
- Completed: add filters:
  - group
  - activity
  - missing
  - late
  - needs grading
- Completed: add CSV export.

### Phase 6A: Formative/Summative Assignment Mode - Completed

- Completed: add assignment-level `assessmentMode` metadata for direct group assignments and course-wide all-groups assignments.
- Completed: default new assignments to formative activity behavior.
- Completed: expose formative/summative selection in group assignment and course-wide all-groups assignment forms.
- Completed: expose core gradebook policy settings in summative assignment forms: points possible, points/pass-fail grading mode, pass threshold, attempt limit mode, max attempts, grade strategy, and drop-lowest for weighted averages.
- Completed: persist those settings into each materialized `GradebookItem`, including all current groups and future groups created from an all-groups rule.
- Completed: pass group assignment metadata into plugin route and renderer context.
- Completed: make Parsons checks analytics-only for formative activities.
- Completed: make Parsons summative submissions create core attempts and automatic grades, with the student-facing Parsons toolbar showing Submit instead of Check.
- Completed: make completed summative Parsons attempts read-only when the attempt limit is reached, so students can review the attempt without starting or submitting another one.
- Completed: suppress correct/incorrect validation messages in summative Parsons mode.

### Phase 7: Student Grade Visibility

- Add student grade view for released grades.
- Hide unreleased grades.
- Hide hidden test details.
- Do not expose attempt history initially.
- Add release controls for teachers.

### Phase 8: Manual Grading And Regrading

- Add plugin-provided manual grading UI mount point.
- Add override workflow.
- Add automatic regrading workflow for plugins that support it.
- Preserve old grade records/events.
- Add tests for manual overrides and regrade audit trails.

### Phase 9: Analytics And Research Exports

- Add attempt/grade analytics queries.
- Add identifiable CSV export.
- Add anonymized export.
- Add external student ID support in exports.
- Add course-level research-consent model and first-access consent flow.

## Testing Strategy

Core service tests:

- gradebook item creation
- attempt lifecycle
- attempt limits
- grade normalization
- pass/fail thresholds
- late penalties
- grade strategy selection
- audit event creation
- authorization
- archived course restrictions

API route tests:

- gradebook views
- attempt submission
- grade recording
- release/hide grades
- CSV export

Plugin integration tests:

- plugin returns raw grading result
- core normalizes and stores grade
- plugin manual grading UI can submit override
- regrading creates audit trail

Frontend tests where practical:

- teacher gradebook renders course/group filters
- student sees only released grades
- hidden grades remain hidden

## Documentation Updates Required During Implementation

- `README.md`: gradebook API surface and content model
- `docs/PROJECT_MEMORY.md`: durable platform decisions
- `docs/plugin-authoring/`: plugin grading contract and examples
- relevant plugin `README.md` and `PROJECT_MEMORY.md` files when each plugin adopts core grading
