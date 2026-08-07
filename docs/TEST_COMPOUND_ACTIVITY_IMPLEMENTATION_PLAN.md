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
- immutable Test revisions;
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

### Future `TestItemAttempt`

Added during the execution phase:

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
      testItemAttemptId: string;
    };
```

Activity definitions declare a capability such as:

```ts
supportsCompositeExecution?: boolean;
```

The Test item picker shows only activities that:

- support attempts;
- support automatic or manual grading;
- support composite execution.

Plugin UI should receive a host adapter rather than hardcode standalone submission routes. The adapter supplies operations such as load, start, save, submit, and obtain grading result. The existing standalone adapter continues using assigned-activity routes; the Test adapter writes a `TestItemAttempt` under the parent attempt.

MCQ is the first integration because its grading is deterministic and it has no plugin-owned submission tables. Other plugins opt in one at a time.

## Attempt Lifecycle

One parent `ActivityAttempt` represents one Test sitting.

Suggested lifecycle:

1. Student starts the Test.
2. Core creates the parent attempt with runtime handler `core:test`.
3. Core snapshots ordered Test items, points, titles, activity config fingerprints, and presentation settings into the attempt manifest.
4. Entering an item creates or resumes its `TestItemAttempt`.
5. Plugin submission produces an ordinary `ActivityGradingResult` for that item.
6. Auto-graded results are stored immediately; manual items remain submitted and awaiting grading.
7. Final Test submission prevents further student edits.
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

No child activity should expose standalone submit, attempt-limit, grade-release, or assignment controls.

## Version and Edit Safety

Initial safety rule:

- unrestricted edits are allowed before attempts exist;
- after the first Test attempt starts, structure, points, and child configuration are locked;
- teachers duplicate the Test when they need a changed future assessment.

Later, introduce immutable `TestRevision` and `TestRevisionItem` snapshots so a draft revision can change while prior attempts remain attached to the exact published revision they used. Plugin-owned private configuration will need a snapshot/copy contract as part of that phase.

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
Until the student runtime phase, new Test content items are forced hidden and group/all-groups assignment rejects the core `test` type.

### Phase 3 — Assignment and Content

- Enable the Test activity type for course creation.
- Enforce summative-only assignment.
- Reuse group/all-groups assignment, content placement, and one gradebook item.
- Reject child assignment/content placement outside the Test.

### Phase 4 — Execution Contract and MCQ

- Add `TestItemAttempt` persistence.
- Add shared standalone/test-item execution host contract.
- Add parent Test attempt orchestration.
- Implement MCQ composite execution first.
- Add Test student runtime and submission flow.

### Phase 5 — Grading and Review

- Aggregate item scores into the parent grade.
- Add manual item grading and parent recomputation.
- Add gradebook Test breakdown and feedback renderer.
- Add release, regrade, override, audit, and analytics coverage.

### Phase 6 — Additional Plugins and Hardening

- Adapt Parsons and coding activities.
- Add Test duplication and immutable revisions.
- Add timer/resume enforcement and concurrency/idempotency tests.
- Add accessibility, localization, and end-to-end coverage.

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
- The core Test type is still excluded from generic plugin activity creation and student execution remains unavailable until the assignment/runtime phases.
