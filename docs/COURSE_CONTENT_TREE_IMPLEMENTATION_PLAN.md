# Course Content Tree Implementation Plan

This document records the agreed course content organization direction before implementation.
It is intentionally a planning artifact. Implementation should proceed iteratively and update this file whenever the model, UI behavior, API surface, migration plan, or rollout order changes.

## Goals

- Show materials and activities together in one course/section learning sequence.
- Organize all course elements, including folders, materials, and activities, in the same folder tree.
- Let teachers add either a material or an activity from the same picker.
- Ask for a destination folder when adding any course element.
- Give every course content item its own visibility flag.
- Keep materials as resources, not activities.
- Preserve strict activity plugin isolation: core may place and show an activity item, but must not inspect plugin-owned persistence or grading internals.
- Keep activity assignment, availability, attempts, grading, and plugin routes separate from content-tree placement and visibility.
- Make it easy to add new material types later.

## Agreed Decisions

### Product Model

Course and section content should be presented as a single tree, for example:

```text
Week 1
  PDF: Introduction to variables
  Coding Exercise: Use the right variable
  GitHub: Examples shown

Week 2 hidden
  PPT: What are loops
  Parsons: Compute the sum from 1 to 100
  Resources
    Link: Codecademy loops
```

Folders are generic course content folders. They are not material-only folders.

The content tree controls:

- nesting
- ordering
- placement
- visibility

The content tree does not control:

- activity plugin behavior
- activity attempts
- activity grading
- plugin-specific submission artifacts
- material file storage internals

### Materials And Activities

Materials and activities remain separate domain concepts.

Materials:

- are resources
- can be shown or hidden
- can be placed in folders
- can be reordered
- are not assigned
- are not attempted
- are not graded

Activities:

- can be shown or hidden through the content tree
- can be placed in folders
- can be reordered
- remain assigned through the existing activity/group assignment model
- keep availability windows, assessment mode, attempt policy, gradebook policy, and plugin routes outside the content tree

### Visibility

Every content item has an explicit visibility flag.

This includes:

- folders
- files
- GitHub repositories
- links
- MCQ activities
- Parsons activities
- coding exercises
- future material or activity types

Effective student visibility is inherited through ancestors:

- if an item is hidden, students do not see it
- if an ancestor folder is hidden, students do not see descendants
- teacher views should show hidden items with clear hidden or hidden-by-parent state

The database should store the local visibility flag. Services/API responses can compute an effective visibility value such as:

```ts
type EffectiveVisibility = "visible" | "hidden" | "hidden_by_parent";
```

### Activity Visibility And Availability

Activity visibility and activity availability are separate.

Visibility answers:

```text
Should students see this activity in the content tree?
```

Availability answers:

```text
If students can see it, can they open or attempt it now?
```

Examples:

- hidden activity: not shown to students
- visible upcoming activity: shown as upcoming or locked, depending UI policy
- visible expired activity: shown as expired/reviewable, but no new attempt can start
- hidden expired activity: not shown to students

Folder visibility wins over activity availability. If a folder is hidden, descendants are not shown regardless of their own availability settings.

### Picker UI

The current activity picker should evolve into a course element picker.

The left rail can remain category-based, with a Material category alongside existing activity categories:

```text
Activity banks
Programming
Miscellaneous
Material
```

The Material category should list material types, not existing material instances. For example, teachers choose "GitHub repository" in the same way they choose an activity type. That action creates a new material shell/content item in the selected folder. The teacher then configures that specific material instance afterward, such as entering the repository URL, adding link details, or uploading/attaching a file.

The title should eventually change from "Choose an activity" to wording such as:

```text
Choose course element
```

or:

```text
Add to course
```

All add flows, whether material or activity, must ask:

- which folder to add into
- whether the new content item is visible to students

The folder selector should use the unified content folder tree:

```text
Root
Week 1
Week 2
Week 2 / Resources
```

If the selected parent folder is hidden, the UI should clearly indicate that the new item will be hidden by parent even if its own visibility flag is on.

### Plugin Isolation

The content tree may reference a generic activity or assigned group activity row.

The content tree must not:

- read plugin-owned tables
- write plugin-owned tables
- copy plugin-owned data
- branch on concrete plugin keys
- know how plugin grading, attempts, or submissions work

Activity-specific rendering should continue to resolve through the activity registry and renderer registry.

Plugin-owned persistence and routes remain in plugin packages. Server plugin hooks remain responsible for plugin-local copy/delete behavior.

## Proposed Core Data Model

Names are provisional and should be validated during schema design.

### `CourseContentItem`

One row per visible or hidden item in the course/section content tree.

Likely fields:

- `id`
- `courseId`
- `groupId`, nullable for course-level structure and course-level content; set for group-specific material/activity placements
- `parentId`, nullable for root-level items
- `kind`: `folder`, `material`, or `activity`
- `titleSnapshot`, nullable or optional depending item kind
- `position`
- `isVisible`
- `materialId`, nullable
- `activityId`, nullable
- `courseGroupActivityId`, nullable
- `metadata`
- `createdAt`
- `updatedAt`

Likely enum:

```prisma
enum CourseContentItemKind {
  folder
  material
  activity
}
```

Rules:

- `folder` items do not reference material or activity rows.
- `folder` items are always course-scoped with `groupId = null`.
- `material` items reference a course material in the same course.
- `activity` items reference a generic course activity or an assigned group activity in the same course.
- Group-specific materials and activities may set `groupId`, but their parent folders still come from the shared course-level folder structure.
- A parent must be a course-scoped folder.
- Parent and child must belong to the same course.
- Folder cycles are forbidden.
- Position is scoped to siblings under the same parent.

### Course-Level Versus Group-Level Scope

The folder structure is decided by teachers at the course level and preserved across groups. This means folders have `groupId = null` and are shared by every group/section in the course.

Course-level materials and activities can also have `groupId = null` when they should appear broadly. Teachers may still add group-specific materials or activities, but those group-specific items are placed into the shared course folders by referencing the course-level folder `parentId`.

Group content queries should return the shared course structure plus the selected group's own content items. Student work, assignment availability, attempts, and gradebook records remain group-scoped.

## Core Service Layer

Add a core service, likely:

```text
packages/core/src/course-content.ts
```

Responsibilities:

- create folder items
- create material content items
- create activity content items
- list teacher content trees
- list student-visible content trees
- compute effective visibility
- move items between folders
- reorder sibling items
- toggle item visibility
- rename folders or update content item snapshots where appropriate
- remove content items
- prevent invalid nesting and cycles
- validate cross-course and cross-group references

The service should use shared authorization patterns from core modules and should not import plugin packages.

## API Surface

Add generic course content routes.

Potential course-level routes:

```text
GET    /api/courses/:courseId/content
POST   /api/courses/:courseId/content/folders
POST   /api/courses/:courseId/content/materials
POST   /api/courses/:courseId/content/activities
PATCH  /api/courses/:courseId/content/:contentItemId
DELETE /api/courses/:courseId/content/:contentItemId
```

Potential group/section-level routes:

```text
GET    /api/courses/:courseId/groups/:groupId/content
POST   /api/courses/:courseId/groups/:groupId/content/folders
POST   /api/courses/:courseId/groups/:groupId/content/materials
POST   /api/courses/:courseId/groups/:groupId/content/activities
PATCH  /api/courses/:courseId/groups/:groupId/content/:contentItemId
DELETE /api/courses/:courseId/groups/:groupId/content/:contentItemId
```

Teacher responses should include all items plus effective visibility.

Student responses should include only effectively visible items, plus safe activity status data such as:

```ts
activityAvailability?: "available" | "upcoming" | "expired";
```

Student content responses must not expose hidden gradebook data, raw plugin grading payloads, hidden tests, or private plugin artifacts.

## Material Type Registry

Add a lightweight material type registry separate from activity plugins.

Initial material types:

- GitHub repository
- file
- text

Folders remain generic content tree items, not material picker options. More material types can be added later, but the initial picker surface should stay limited to the three types above.

Potential definition shape:

```ts
type MaterialTypeDefinition = {
  key: string;
  name: LocalizedText;
  description?: LocalizedText;
  iconName: string;
  createMode: "folder" | "upload" | "form";
  rendererKey?: string;
};
```

This should make future material types easier to add without making them activities and without giving them the full activity plugin lifecycle.

If future material types need external installable behavior, a separate material plugin model can be designed later.

Important distinction: material type definitions are picker options; concrete materials are course content instances. The picker must not show a list of existing repositories/links/files as the way to add material. Reusing or duplicating an existing material can be designed later as a separate action if needed.

## Migration Plan

Current course materials are already organized into folders. Those folders should become generic content folders.

Migration should:

- create `CourseContentItem(kind: "folder")` rows for existing material folders
- create `CourseContentItem(kind: "material")` rows for existing non-folder materials
- preserve existing parent/child relationships
- preserve existing ordering
- keep existing `CourseMaterial` records for material metadata and file/repo/link data
- stop treating `CourseMaterial.parentId` as the canonical student-facing hierarchy once the content tree is live

Avoid deleting old hierarchy fields in the first migration unless the implementation is ready to update every caller.

## Activity Placement

When a teacher adds or assigns an activity, the flow should also create a content item in the selected folder.

For group assignment:

```text
CourseGroupActivity created
CourseContentItem(kind: activity, courseGroupActivityId: ...)
```

For course-level activity placement, if supported:

```text
Activity created or selected
CourseContentItem(kind: activity, activityId: ...)
```

The content item should only point to the generic activity/assignment row. Plugin-specific data remains owned by plugin packages.

## Teacher UI

Teacher content management should eventually replace separate material and activity lists where a unified learning sequence is more natural.

Teacher actions common to all content items:

- move
- reorder
- move to folder
- toggle visibility
- remove from content tree

Folder-specific actions:

- create folder
- rename folder
- hide/show folder
- move folder
- delete folder, with clear handling of descendants

Material-specific actions:

- create/upload/add material
- edit material metadata
- open/download material
- remove material from content tree

Activity-specific actions:

- add/select activity
- edit activity
- edit assignment settings
- edit availability dates
- edit assessment mode and gradebook policy
- open gradebook results where relevant
- remove activity from content tree or assignment according to the existing assignment rules

## Student UI

The student section workspace should render the unified content tree.

Rules:

- hidden items are not shown
- descendants of hidden folders are not shown
- visible materials are openable according to their type
- visible upcoming activities are shown as upcoming or locked
- visible expired activities can be shown as expired/reviewable according to the activity/attempt policy
- visible available activities are openable
- grade release remains controlled by the gradebook, not the content tree

This preserves the documented student-first, section-first navigation model.

## Implementation Phases

### Current Status

- Phase 1 is implemented.
- Phase 2 is implemented.
- Phase 3 is implemented.
- Phase 4 is implemented for the current single-user/dev-data state.
- Phase 5 is implemented at the service/contract layer.
- Phase 6 is implemented.
- Phase 7 is implemented.
- The schema foundation lives in `packages/db/prisma/schema.prisma`.
- The migration lives in `packages/db/prisma/migrations/202605260001_course_content_tree/migration.sql`.
- The schema foundation test lives in `packages/db/prisma/course-content-schema.test.ts`.
- The core service lives in `packages/core/src/course-content.ts`.
- The core service test lives in `packages/core/src/course-content.test.ts`.
- The API routes live under:
  - `apps/api/src/app/api/courses/[courseId]/content`
  - `apps/api/src/app/api/courses/[courseId]/groups/[groupId]/content`
- The API route tests live in:
  - `apps/api/src/app/api/courses/[courseId]/content/route.test.ts`
  - `apps/api/src/app/api/courses/[courseId]/groups/[groupId]/content/route.test.ts`
- The seed content tree lives in `packages/db/prisma/seed.ts`.
- Activity creation and assignment now accept optional `contentPlacement` in shared contracts.
- Verification completed after Phase 1:
  - `npx prisma validate --schema packages/db/prisma/schema.prisma`
  - `npm run db:migrate:all`
  - `npm test`
  - `npm run typecheck`
- Verification completed after Phase 2:
  - `npx vitest run packages/core/src/course-content.test.ts`
  - `npm run typecheck --workspace @cognelo/core`
  - `npm test`
  - `npm run typecheck`
- Verification completed after Phase 3:
  - `npx vitest run apps/api/src/app/api/courses/[courseId]/content/route.test.ts apps/api/src/app/api/courses/[courseId]/groups/[groupId]/content/route.test.ts packages/core/src/course-content.test.ts`
  - `npm run typecheck --workspace @cognelo/api`
  - `npm run typecheck --workspace @cognelo/core`
  - `npm test`
  - `npm run typecheck`
- Verification completed after Phase 4:
  - `npm run typecheck --workspace @cognelo/db`
  - `npx vitest run packages/db/prisma/course-content-schema.test.ts packages/core/src/course-content.test.ts`
  - `npm run db:seed`
  - `npm test`
  - `npm run typecheck`
- Verification completed after Phase 5:
  - `npx vitest run packages/contracts/src/schemas.test.ts packages/core/src/activities.test.ts packages/core/src/groups.test.ts`
  - `npm run typecheck --workspace @cognelo/core`
  - `npm test`
  - `npm run typecheck`
- Verification completed after Phase 6 initial slice:
  - `npx vitest run apps/web/src/lib/i18n.test.ts apps/web/src/lib/api.test.ts`
  - `npm run typecheck --workspace @cognelo/web`
  - `npm test`
  - `npm run typecheck`
- Verification completed after Phase 6 completion:
  - `npx vitest run packages/contracts/src/schemas.test.ts apps/web/src/lib/i18n.test.ts apps/web/src/lib/api.test.ts`
  - `npm run typecheck`
  - `npm test`

### Phase 1: Schema Foundation - Complete

- Add `CourseContentItem` and related enum.
- Add indexes and constraints for course, group, parent, kind, and position queries.
- Add a migration.
- Keep existing material and activity tables unchanged.

### Phase 2: Core Services And Tests - Complete

- Implement `packages/core/src/course-content.ts`.
- Add tests for creation, movement, ordering, visibility, tree listing, and authorization boundaries.
- Add cycle-prevention tests.
- Add cross-course and cross-group validation tests.

### Phase 3: API Routes - Complete

- Add course/group content routes.
- Add API tests for teacher and student access.
- Ensure student routes filter by effective visibility.

### Phase 4: Material Migration And Compatibility - Complete For Dev Seed

- Migrate existing material folders/items into content items.
- Keep existing material endpoints working during transition.
- Update material tree reads to use content tree where appropriate.

Decision after Phase 3: Cognelo currently has no production content to preserve. Instead of spending effort on a historical backfill, the first Phase 4 slice makes the seed data exercise the new content tree directly. The sample course now includes a mixed folder/material/activity tree with visible and hidden folders. A future production migration can still be designed if durable content exists later.

### Phase 5: Activity Placement - Complete At Service Layer

- Add folder selection and content item creation to activity add/assignment flows.
- Ensure group assignment creates a group-scoped content item.
- Ensure course-wide assignment behavior remains compatible with existing all-groups policy and future group inheritance.

Implemented scope: `ActivityInputSchema`, `CourseGroupActivityInputSchema`, and all-groups assignment input support optional `contentPlacement`. Course activity creation can create a course-scoped activity content item. Direct group assignment can create a group-scoped activity content item in a selected shared course folder. All-groups assignment stores placement metadata and materializes activity content items for current and future groups using the same shared course folder IDs.

### Phase 6: Unified Picker - Complete

- Rename the modal concept from activity-only to course-element selection.
- Add Material as a picker category beside activity categories.
- Add folder selection and visibility controls for both materials and activities.
- Keep plugin activity type discovery through the existing registry.

Implemented scope: the course activity picker is now a course-element picker. It loads course content folders, offers a Material tab, lets teachers choose a destination folder and visibility, creates course-level folders from the picker, creates new material shells from material type choices, places those new materials into the content tree, and sends `contentPlacement` when creating local or bank-backed course activities. Direct group assignment and course-wide all-groups assignment also ask for folder and visibility and pass `contentPlacement`. Full group/student unified tree rendering remains later work.

### Phase 7: Unified Teacher Content Tree - Complete

- Render materials and activities together for teacher management.
- Add visibility toggles for all item types.
- Add move/reorder controls.
- Preserve existing activity assignment and gradebook controls.

Implemented scope: the course page and group teacher page have unified Content tabs that render folders, materials, and activities together. The course page shows course-level content only. The group page shows the shared course folders plus that group's own content. Teachers can toggle visibility, move items between shared course folders, reorder items within their scope, open linked activities/materials, and remove items from the content tree. Content rows have a settings overlay: course activity rows expose the all-groups assignment/settings flow, GitHub repository material rows ask for title and repository URL, file material rows ask for title and upload, and text material rows expose a text editor. Existing gradebook controls remain in their dedicated tab.

Verification completed after Phase 7:

- `npm run typecheck`
- `npx vitest run apps/web/src/lib/i18n.test.ts apps/web/src/lib/api.test.ts`
- HTTP 200 smoke checks for:
  - `/courses/seed-course-programming-101`
  - `/courses/seed-course-programming-101/groups/seed-group-programming-101-section-a`
- `npm test`

### Phase 8: Student Content Tree

- Render the unified tree in the student section workspace.
- Use effective visibility and activity availability to determine display and openability.
- Keep student grade visibility and feedback behavior backed by the gradebook APIs.

### Phase 9: Material Type Registry

- Introduce lightweight material type definitions.
- Register existing material types.
- Update the Material picker category to render from the registry.

### Phase 10: Documentation And Cleanup

- Update root `README.md`.
- Update `docs/PROJECT_MEMORY.md`.
- Update plugin docs only if plugin behavior changes.
- Remove or deprecate old material-only hierarchy UI once the content tree is canonical.

## Testing Plan

Core tests should cover:

- create folder
- create material item
- create activity item
- reorder items
- move item to another folder
- reject non-folder parents
- reject folder cycles
- reject cross-course references
- reject cross-group references
- compute effective visibility
- hide descendants through hidden parent
- list teacher tree with hidden items
- list student tree without hidden items

API tests should cover:

- teacher can create and update content items
- student receives only visible content
- hidden activity content cannot be opened by students through content navigation
- hidden material content is not returned to students
- unauthorized users are blocked
- plugin dispatch routes remain unaffected

Migration tests should cover:

- existing material folders become content folders
- existing material parent relationships are preserved
- material ordering is preserved
- non-folder materials become material content items

Frontend tests should be added where existing test patterns support:

- content tree helper behavior
- i18n keys
- API client methods
- picker category behavior

## Documentation Updates

Because this is a platform-level architecture change, update:

- `README.md`
- `docs/PROJECT_MEMORY.md`

Document:

- `CourseContentItem` as the shared content tree
- folders as generic course content folders
- visibility as content-tree state
- activity availability as separate from content visibility
- materials remaining non-activity resources
- activity plugin isolation remaining unchanged
- material type registry being lightweight and separate from activity plugins

Plugin package documentation only needs updates when a plugin's own behavior, persistence, or route contract changes.
