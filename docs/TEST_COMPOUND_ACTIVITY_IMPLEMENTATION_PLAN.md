# Test Compound Activity Implementation Plan

This document defines the implementation direction for the core **Test** activity. It is a living implementation artifact and must be updated when the persistence model, activity-provider contract, authoring workflow, execution contract, grading behavior, or rollout order changes.

## Objective

A Test is a core-owned compound activity composed of ordinary plugin-backed activities.

It must:

- behave as one assignable activity in course content;
- always be summative;
- create one group assignment and one gradebook entry;
- contain ordered, independently authored activities;
- accept activities copied from an activity bank;
- accept new activities created only inside the Test;
- preserve each child activity's normal plugin configuration and grading behavior;
- expose one student attempt, one submission, and one released grade;
- retain a per-item result breakdown for teacher review and audit.

## Non-Goals

The first implementation does not include:

- reusable Tests in activity banks;
- direct references to mutable standalone course activities;
- independently assigned or independently released Test items;
- nested Tests;
- collaborative/group submissions;
- support for every activity plugin on day one.

## Core Design Decision

Use the composite pattern with a core-backed Test shell:

```text
Core Test Activity
└── Test
    ├── TestItem → plugin Activity
    ├── TestItem → plugin Activity
    └── TestItem → plugin Activity
```

The outer Test is a genuine course `Activity` whose activity type is owned by core rather than an installable plugin. This lets the existing platform continue to use:

- `CourseGroupActivity` for assignment;
- the existing all-groups assignment policy;
- `CourseContentItem` for content-tree placement;
- `GradebookItem` for the single Test gradebook entry;
- `ActivityAttempt` for the parent Test sitting;
- the existing attempt-limit, availability, late-policy, grade-selection, and release services.

The child activities are normal course-local `Activity` rows backed by their ordinary plugins. They are contained by `TestItem` and are not independently assigned.

## Activity Provider Model

Activity definitions can be provided by either:

```ts
type ActivityProvider =
  | { kind: "core"; key: string }
  | { kind: "plugin"; key: string };
```

Core-backed activities:

- participate in the shared activity registry;
- do not have an `ActivityPluginInstallation`;
- cannot be activated/deactivated through plugin administration;
- are not dispatched through plugin routes;
- use core services and core web renderers;
- may still use the generic `Activity`, assignment, content, attempt, and gradebook infrastructure.

The first core definition is `test`. It remains disabled in the generic activity-type list, but Phase 2 exposes a dedicated core Test action in the course picker. This keeps Test creation out of plugin installation/activation while allowing the authoring surface to evolve before student runtime is enabled.

`ActivityType` records explicitly persist `providerKind` and `providerKey`. Existing activity types migrate to `providerKind = plugin`, with `providerKey` populated from existing plugin metadata where available.

## Persistence Model

### Existing `Activity`

The Test shell stores generic activity fields:

- title;
- student instructions/description;
- lifecycle;
- course ownership;
- content placement;
- creator and timestamps.

Each child is also an `Activity`, preserving:

- activity type and plugin ownership;
- bank/version provenance;
- generic configuration and metadata;
- plugin-owned course data copied through lifecycle hooks.

### `Test`

One row per Test shell:

```text
id
courseId
activityId          unique; outer core Test Activity
settings            JSON for bounded Test-wide settings
createdAt
updatedAt
```

The normalized row distinguishes Test orchestration state from the generic Activity config. Settings may initially contain time limit, navigation mode, resume policy, and item-order behavior, but composition must never be stored as an array of IDs in JSON.

### `TestItem`

One row per contained activity:

```text
id
testId
activityId          unique; one Test owns the child
position
pointsPossible
isRequired
metadata
createdAt
updatedAt
```

Invariants:

- the Test shell and child activity belong to the same course;
- a child activity belongs to exactly one Test;
- the Test shell cannot be its own child;
- a Test cannot contain another Test;
- authoring accepts enabled plugin activities; publishing/assignment must require `supportsCompositeExecution` once the runtime contract is enabled;
- positions are non-negative and normalized by the service after reorder operations;
- points are positive;
- child activities do not have independent group assignments or content placements.

Cross-row invariants are enforced in the core Test service and covered by service tests.

### `TestItemAttempt`

Added in Phase 4:

```text
id
parentAttemptId     parent Test ActivityAttempt
testItemId
activityId
lifecycle
rawScore
rawMaxScore
normalizedScore
normalizedMaxScore
pluginAttemptRef
result
feedback
activityConfigFingerprint
startedAt
submittedAt
gradedAt
createdAt
updatedAt
```

There is one item-attempt row per Test item per parent Test attempt. Child results never create independent gradebook grades.

## Activity Ownership and Copy Semantics

### Add from bank

Adding a bank activity to a Test creates a course-local activity copy using the existing bank-version copy path. It must:

- preserve `bankActivityId` and `activityVersionId` provenance;
- copy generic activity configuration;
- invoke the owning plugin's `onCourseActivityCreatedFromBankVersion` hook;
- compensate by deleting the child and `TestItem` if plugin-owned copying fails;
- omit top-level course content placement.

The Test never points directly at a mutable bank activity.

### Create inside Test

The teacher chooses an enabled activity type and authors it using the normal plugin editor. The created course Activity is attached to a `TestItem` and excluded from top-level course activity and assignment pickers.

### Existing standalone course activities

The initial version does not link an existing standalone activity directly. A future "Copy into Test" action may clone it. This prevents edits to a standalone assignment from silently changing a summative Test.

### Delete

Deleting a Test must transactionally:

1. remove or archive Test attempts according to gradebook deletion policy;
2. invoke course-activity deletion hooks for each child plugin activity once such a hook exists;
3. delete child activities and Test items;
4. delete the Test shell, assignments, content placements, and gradebook data through existing relations.

A generic `onCourseActivityDeleted` plugin hook should be added before plugins with private course tables can be safely used as Test children.

## Assignment and Content Behavior

Only the outer Test Activity is assignable.

Assignment behavior:

- assessment mode is always `summative`;
- availability and due dates belong to the Test assignment;
- attempt limits and grade strategy belong to the Test gradebook item;
- all-groups assignment materializes one Test assignment per current group and remains inherited by future groups;
- per-group settings follow the existing all-groups policy;
- one content-tree row represents the Test;
- Test items never appear as sibling course-content rows.

The assignment service must reject a child Activity ID when called outside its containing Test.

## Embedded Activity Execution Contract

The main cross-cutting work is allowing a plugin activity to execute without its own `CourseGroupActivity` and `GradebookItem`.

Introduce a shared execution context:

```ts
type ActivityExecutionContext =
  | {
      kind: "standalone";
      groupActivityId: string;
      activityAttemptId: string;
    }
  | {
      kind: "test_item";
      parentAttemptId: string;
      testItemId: string;
      testItemAttemptId: string | null;
    };
```

Activity definitions declare a capability such as:

```ts
supportsCompositeExecution?: boolean;
```

The authoring picker remains the shared, provider-neutral activity picker and may show any enabled current or future plugin activity. This is intentional: teachers can compose a Test before every child plugin has implemented student execution. Assignment/start validation must clearly identify children that do not yet declare `supportsCompositeExecution`.

Plugin UI should receive a host adapter rather than hardcode standalone submission routes. The adapter supplies operations such as load, start, save, submit, and obtain grading result. The existing standalone adapter continues using assigned-activity routes; the Test adapter writes a `TestItemAttempt` under the parent attempt.

Inside a Test, child student renderers receive only the state-loading and autosave portion of that host. They must not display or invoke an individual activity submission. The single **Submit Test** action submits every child from its saved state through the registered server adapters, persists each item result, and only then finalizes the parent attempt.

MCQ is the first integration because its grading is deterministic and it has no plugin-owned submission tables. Other plugins opt in one at a time.

The extension points are deliberately split by responsibility:

- activity definitions advertise `supportsCompositeExecution`;
- server plugins register a composite submission handler by activity type key;
- the web application registers an embedded student renderer by activity type key;
- core stores generic item state, scores, feedback, plugin references, and fingerprints without importing plugin-specific schemas.

Adding a future activity plugin to Tests therefore requires capability declaration and server/web adapters, not a new Test table, Test route family, or plugin-key branch in core orchestration.

## Attempt Lifecycle

One parent `ActivityAttempt` represents one Test sitting.

Suggested lifecycle:

1. Student starts the Test.
2. Core creates the parent attempt with runtime handler `core:test`.
3. Core snapshots ordered Test items, points, titles, activity config fingerprints, and presentation settings into the attempt manifest.
4. Entering an item creates or resumes its `TestItemAttempt`.
5. Plugin submission produces an ordinary `ActivityGradingResult` for that item.
6. Child state is autosaved while the student works; no child has an individual submission action.
7. Final Test submission dispatches all saved child states, stores auto-graded results (or marks manual items for grading), and prevents further student edits.
8. When all required item results are available, core aggregates them and records one parent grading result.

Test-level rules apply to the entire sitting:

- availability;
- due date and lateness;
- time limit;
- attempt count;
- resume policy;
- grade release;
- feedback release.

Children do not apply independent availability or attempt-limit rules.

Standalone activities may persist unfinished state in core `ActivityResponseDraft` rows, but Tests deliberately do not use that path. Test children continue to serialize autosaves through the parent runtime into `TestItemAttempt`, preserving timer, no-resume, finalization, and trailing-save guarantees.

The current `ActivityAttempt.pluginKey` name is too narrow for a core runtime. The long-term field should be `runtimeHandlerKey`, with values such as `plugin:mcq` and `core:test`. A compatibility migration can retain existing values while the service contract changes.

## Grading

Each item has `pointsPossible`, defaulting to equal points.

For each completed item:

```text
item points earned = (plugin raw score / plugin raw max) × TestItem.pointsPossible
```

The parent raw result is:

```text
rawScore    = sum(item points earned)
rawMaxScore = sum(TestItem.pointsPossible)
```

The existing gradebook service then normalizes the parent result to the configured Test gradebook scale and applies late policy and grade-selection strategy.

The parent grading result stores a structured item breakdown for:

- teacher review;
- manual grading;
- regrading;
- feedback rendering;
- analytics and audit.

Manual-grading behavior:

- submitted manual items make the parent Test "needs grading";
- grading or regrading an item recomputes the parent result;
- a teacher may override the final parent grade through the normal gradebook override flow;
- item feedback remains hidden until the parent Test gradebook item is released.

## Authoring UX

The course content picker receives an explicit **Test** action separate from installable plugin activities.

The Test editor includes:

- title;
- student instructions using the shared Markdown-backed WYSIWYG editor;
- Test-level timing/navigation settings;
- ordered item list;
- Add activity from bank;
- Create activity;
- edit, duplicate, reorder, and remove item actions;
- points per item and calculated total;
- teacher preview;
- save/discard and unsaved-change protection.

Opening an item embeds its normal plugin authoring view in a Test-specific route. The child remains invisible in ordinary course activity lists.

## Student UX

The Test opens as one assigned activity. The shell provides:

- Test title and instructions;
- attempt/start confirmation;
- optional timer;
- progress and item navigation;
- one embedded child activity at a time, or a continuous layout when configured;
- save/resume state;
- final submission confirmation;
- read-only submitted state;
- released overall grade and permitted item feedback.

When a new attempt is blocked by grade release, the due date, or the attempt limit, the student Test shell remains visible with a disabled start action and a localized explanation. The assigned-activity tab shell must not hide the Test renderer merely because attempt availability is false.

No child activity should expose standalone submit, attempt-limit, grade-release, or assignment controls.

## Version and Edit Safety

Edit safety rules:

- unrestricted edits are allowed until the first Test attempt starts;
- starting an attempt creates an immutable `TestRevision` plus ordered `TestRevisionItem` snapshots and attaches the parent attempt to that revision;
- after the first attempt, structure, points, generic child configuration, and supported plugin-owned private authoring data are locked;
- teachers use **Duplicate Test** to create an independent draft shell, child activities, item settings, and plugin-owned private data for future changes.

## API and Service Boundaries

Core service module: `packages/core/src/tests.ts`.

Planned operations:

- create/get/update/delete Test;
- list Test items;
- add bank activity to Test;
- create local child activity;
- update/reorder/remove/duplicate item;
- validate assignability;
- start/resume Test attempt;
- start/save/submit item attempt;
- submit Test;
- grade/regrade item;
- aggregate parent result.

Routes should be core Test routes, not plugin-dispatch routes. Authorization uses existing course/group authorization and participant resolution.

## Rollout Phases

### Phase 1 — Foundation

- [x] Add core-vs-plugin activity provider metadata and registry resolution.
- [x] Register the disabled core `test` definition.
- [x] Add `Test` and `TestItem` Prisma models and migration.
- [x] Add schema/registry tests.
- [x] Do not expose Test creation yet.

### Phase 2 — Authoring and Ownership

- [x] Add core Test CRUD services and contracts.
- [x] Add bank-copy and local-child creation flows.
- [x] Add containment filtering to course activity/assignment lists.
- [x] Add Test deletion and plugin course-delete lifecycle hook.
- [x] Build the initial Test authoring shell and item editor routing.

Phase 2 intentionally leaves Test duplication, teacher runtime preview, and immutable revisions for the later hardening/runtime phases. Test item editing reuses each plugin's normal course authoring renderer and returns to the owning Test.

### Phase 3 — Assignment and Content

- [x] Enable the Test activity type for course creation through its dedicated core flow.
- [x] Enforce summative-only assignment in direct-group and all-groups services and authoring UI.
- [x] Reuse group/all-groups assignment, content placement, future-group inheritance, and one gradebook item per assigned Test.
- [x] Reject child assignment/content placement outside the Test.

Core Test types remain protected from the generic plugin activity creation/update routes so a Test shell cannot be created without its normalized `Test` row. Test content visibility now follows the teacher's selected placement. Student execution remains unavailable until Phase 4 adds the composite execution contract and Test runtime.

### Phase 4 — Execution Contract and MCQ

- [x] Add `TestItemAttempt` persistence.
- [x] Add shared standalone/test-item execution host contract.
- [x] Add parent Test attempt orchestration.
- [x] Implement MCQ composite execution first.
- [x] Add Test student runtime and submission flow.

Phase 4 establishes plugin-neutral persistence and dispatch. The student Test shell now starts/resumes one parent attempt, snapshots an ordered manifest, autosaves child state without child-level submit controls, and uses the single final Test submission to grade all MCQ items through the MCQ adapter before finalizing the parent attempt. Parent score aggregation and gradebook review remain Phase 5 work; timer enforcement, immutable revisions, and more plugin adapters remain Phase 6 work.

### Phase 5 — Grading and Review

- [x] Aggregate item scores into the parent grade.
- [x] Add manual item grading and parent recomputation.
- [x] Add gradebook Test breakdown and feedback renderer.
- [x] Add release, regrade, override, audit, and analytics coverage.
- [x] Add individual and aggregate teacher review surfaces.

Implemented in Phase 5:

- Final Test submission now aggregates the manifest's weighted item scores and records one ordinary parent `Grade`. Existing grade strategies, late penalties, release controls, and `GradeEvent` audit records therefore apply without a Test-specific gradebook.
- The normalized parent result carries a plugin-neutral per-item breakdown. Teachers see it in detailed results, and students see it only through the existing released-grade feedback path.
- Teachers can adjust an individual Test item score; the item stores the manual-grading reason and the parent grade is recomputed immediately. Whole-Test overrides preserve the structured item breakdown.
- Test regrading recomputes the parent from its immutable child result snapshot. Re-executing child plugin grading logic is unnecessary while attempted Test content is locked; later revision support must dispatch regrading through each child's registered adapter.
- Child scores are not exposed by the embedded activity renderer. The released parent Test grade and breakdown are the student-facing result.
- Teacher review reads child attempt state directly, including submissions created before parent aggregation was introduced. **Review all** uses each student's latest completed Test attempt and is a report: the Test shell shows submission rate, score distribution, duration, lateness, and plugin-neutral per-activity performance, then dispatches each contained activity through a review registry for richer analysis. The MCQ renderer adds activity score statistics and per-question exact-answer accuracy/unanswered counts while preserving selection counts and respondent names per choice, without coupling the Test shell to MCQ parsing.

### Phase 6 — Additional Plugins and Hardening

- [x] Adapt Parsons through the generic composite execution, embedded student, individual review, and aggregate review contracts.
- [x] Adapt coding exercise and web-design coding activities through the same generic contracts.
- [x] Add Test duplication and immutable Test/Test-item revisions.
- [x] Enforce the server-authoritative time limit for child writes and automatically submit saved answers when the browser countdown expires.
- [x] Make repeated final-submit requests idempotent.
- [x] Enforce the resume policy and protect final submission with a database-backed concurrency claim.
- [x] Add accessibility, localization, route/service end-to-end, and full-suite coverage.

The first Phase 6 slice adds Parsons without introducing Parsons-specific fields into the Test schema or orchestration. The embedded renderer persists the initial randomized block arrangement, autosaves subsequent moves through the shared execution host, and suppresses the child submit action. The one **Submit Test** operation evaluates the saved arrangement through the server adapter. Teacher review uses plugin-registered individual and aggregate renderers.

Timed attempts now expose a server-derived deadline in the Test runtime. Child reads and writes reject expired attempts, while final submission is explicitly allowed to grade the last saved state after expiry. The student shell displays a live localized countdown and automatically finalizes once pending saves have drained. Repeating the same final-submit request returns the already-completed runtime instead of producing an active-attempt error.

Autosaves that race with final submission are also idempotent. Once the parent Test or child item has been submitted/graded, a trailing child-state save returns the stored item attempt without changing its graded state or surfacing a false active-attempt error to the student.

Coding exercise and web-design coding exercise now opt into composite execution without introducing type-specific branches in core. They load and autosave through the shared execution host, expose only registered safe preview/run actions, suppress child submission, and run hidden tests only when the parent Test is submitted. The coding homework grader remains intentionally excluded because its ZIP/preflight/manual-review workflow does not yet satisfy the autosaved-state and automatic-finalization contract.

Each newly started Test attempt is attached to an immutable revision snapshot. Test duplication creates an independent draft shell and child rows, then invokes plugin duplication hooks for private authoring data. The no-resume policy is enforced with a browser-session identifier; returning in a new session causes the server to reject further child writes and the student shell to finalize the last saved state. A unique `TestSubmissionClaim` ensures that only one concurrent final-submit request runs child graders, while completed retries remain idempotent.

## Verification Strategy

Each phase requires:

- Prisma schema validation and client generation;
- migration verification against an existing database and a fresh database;
- core service unit tests for ownership and authorization;
- route tests for scope and validation;
- registry tests for core vs plugin providers;
- gradebook tests proving one Test assignment creates one gradebook item;
- tests proving children cannot be independently assigned;
- tests proving child plugin copy hooks run;
- attempt aggregation and manual-grading tests;
- teacher and student browser verification;
- full typecheck before enabling Test creation.

## Current Status

- Design documented.
- Phase 1 foundation implemented.
- Phase 2 authoring and ownership implemented: dedicated Test creation, settings, local/bank child composition, reorder/remove/edit flows, containment filters, and lifecycle-safe deletion.
- Phase 3 assignment and content integration implemented: Test is enabled through its dedicated creation flow, assignments are summative-only, direct/all-groups/future-group materialization reuses the existing content and gradebook paths, and contained children cannot be assigned or placed independently.
- Phase 4 execution and the first MCQ adapter are implemented. Students receive a dedicated Test start/resume and navigation shell rather than the teacher authoring form. Core persists one parent attempt plus generic per-item attempts. MCQ answers autosave without an individual submit button; **Submit Test** dispatches every child through capability/handler/renderer registries designed for additional plugins and then submits the parent once.
- Phase 5 grading and review are implemented: parent aggregation, normal gradebook/release/audit integration, Test breakdowns, item-level manual adjustment with parent recomputation, parent override preservation, Test regrading, individual attempt review, and extensible aggregate review.
- Phase 6 is implemented. MCQ, Parsons, coding exercise, and web-design coding exercise use plugin-owned composite execution/review adapters; Test attempts use immutable revisions; duplication copies generic and plugin-owned data; deadlines and no-resume rules are server-enforced; final submission is idempotent and concurrency-safe; and the student shell includes localized, accessible timing, navigation, save, and submission states.
