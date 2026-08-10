# Edit action bar rollout inventory

## Purpose

This document inventories Cognelo authoring and settings surfaces that could adopt the subject editor's action pattern:

- a visually separate, bottom-positioned Save/Cancel action bar;
- an explicit saved or unsaved status;
- a responsive mobile layout;
- integration with the existing unsaved-changes navigation guard.

This is a planning inventory only. It does not authorize applying one global save state to every mutation on a page. Several Cognelo screens combine drafts, immediately persisted actions, and independently saved forms; those boundaries must remain truthful to the user.

## Classification

- **Implemented**: the surface has a coherent draft, save operation, discard behavior, and the shared action bar.
- **Adapt**: the pattern is useful, but dirty tracking, cancellation semantics, or multiple save boundaries must first be clarified or implemented.
- **Exclude**: the interaction is not an edit-page draft. It should retain local actions, immediate persistence, or its specialized workflow.

## Reference implementation

| Surface | Route | Component | Status |
| --- | --- | --- | --- |
| Subject editor | `/subjects/:subjectId/edit` | `apps/web/src/app/subjects/[subjectId]/edit/page.tsx` | Implemented reference: one subject draft, sticky action bar, saved/unsaved status, responsive controls, Save and discard-to-saved-state actions. |

The reusable implementation should complement `useUnsavedChangesGuard`: the guard protects navigation, while the visible bar communicates and acts on the same draft state.

## Primary rollout candidates

### Host application

| Surface | Route/context | Owner | Classification | Current state and rollout note |
| --- | --- | --- | --- | --- |
| Course general settings | `/courses/:courseId?tab=settings&section=general` | `apps/web/src/components/course-settings-panel.tsx`, `apps/web/src/components/course-form.tsx` | **Implemented** | The form-local bar restores saved course values. |
| Course AI settings | `/courses/:courseId?tab=settings&section=ai` | `apps/web/src/components/course-settings-panel.tsx` | **Implemented** | Its independent bar restores the saved agent selection. |
| Profile identity | `/settings/profile` | `apps/web/src/app/settings/profile/page.tsx` | **Implemented** | Independent section-local identity bar. |
| Password change | `/settings/profile` | `apps/web/src/app/settings/profile/page.tsx` | **Implemented** | Independent section-local password bar; profile status never claims to save password fields. |
| Test settings | Course activity authoring route | `apps/web/src/components/test-activity-view.tsx` | **Implemented** | The settings bar excludes immediately persisted Test composition actions; Duplicate remains a separate secondary action. |

`/courses/:courseId/edit` is only a redirect to course general settings. It has no edit UI of its own and requires no action bar.

### Plugin-owned activity authoring

The following authoring views render in both course activity and activity-bank contexts unless noted otherwise:

- `/courses/:courseId/activities/:activityId`
- `/activity-banks/:bankId/activities/:bankActivityId`

| Activity type | Owner component | Classification | Current state and rollout note |
| --- | --- | --- | --- |
| Multiple-choice question | `packages/plugin-activities/plugin-mcq/src/web/mcq-activity-view.tsx` | **Implemented** | One bar covers the guarded authoring draft. |
| Parsons problem | `packages/plugin-activities/plugin-parsons/src/web/parsons-activity-view.tsx` | **Implemented** | One bar restores the saved authoring snapshot. |
| Coding exercise | `packages/plugin-activities/plugin-coding-exercises/src/web/coding-exercise-activity-view.tsx` | **Implemented** | The bar covers the combined public and plugin-private authoring save. |
| Web-design coding exercise | `packages/plugin-activities/plugin-web-design-coding-exercises/src/web/web-design-coding-exercise-activity-view.tsx` | **Implemented** | The bar remains present across the tabbed combined draft. |
| Coding homework grader | `packages/plugin-activities/plugin-coding-homework-grader/src/web/coding-homework-grader-activity-view.tsx` | **Implemented** | The bar covers activity and plugin-owned grading configuration. |

The core Test renderer is currently course-owned rather than activity-bank-owned. The other five renderers should be implemented once per shared activity view, not duplicated in both route wrappers.

## Surfaces requiring adaptation first

| Surface | Route/context | Owner | Classification | Prerequisite or design decision |
| --- | --- | --- | --- | --- |
| Group settings | `/courses/:courseId/groups/:groupId?tab=settings` | `apps/web/src/app/courses/[courseId]/groups/[groupId]/page.tsx` | **Adapt** | Add a saved snapshot, dirty comparison, discard callback, and `useUnsavedChangesGuard` before exposing saved/unsaved status. |
| AI agent settings | `/settings/ai-agents` | `apps/web/src/app/settings/ai-agents/page.tsx` | **Adapt** | The page mixes preference changes, connection creation/editing, and list actions. Define separate draft boundaries; do not add one page-wide “all saved” bar. |
| Activity-bank inline activity editor | `/activity-banks/:bankId` | `apps/web/src/app/activity-banks/[bankId]/page.tsx` | **Adapt** | This is an inline/overlay form rather than an edit page. A compact form-local footer may be appropriate, but a viewport-wide sticky bar would obscure the parent-page boundary. |
| Bank activity lifecycle | Activity-bank activity authoring route | Route wrapper/lifecycle control | **Adapt** | Lifecycle changes currently persist independently from the activity draft. Keep the control explicitly immediate-save, or deliberately fold it into the authoring draft before sharing one status. |
| Embedded content settings | Course content dialogs/panels | File, GitHub, and text content-type plugin `settings.tsx` components | **Adapt** | These are modal or embedded resource editors with local persistence. Consider a compact dialog footer variant, not the page-level bar. |

## Excluded from this rollout

| Surface category | Examples | Reason |
| --- | --- | --- |
| Creation flows | `/subjects`, `/courses/new`, `/activity-banks` creation forms | They create a new resource rather than edit a saved version. Consistent mobile form actions can be a separate follow-up, but “no unsaved changes” and revert-to-saved semantics do not apply before creation. |
| Immediate settings | `/settings/plugins` plugin enable/configure controls | Each action persists immediately; presenting a page draft would be misleading. |
| Course and group inline operations | Create group, assign activity, add participant, reorder or availability controls | These are discrete mutations, not one page-level edit transaction. Keep controls near the affected item. |
| Activity/test composition mutations | Add, remove, reorder, duplicate, or update test items where the operation saves immediately | Their persistence boundary differs from the activity settings draft. They must not be covered by a settings bar's saved indicator. |
| Student work | Assigned activity attempts, responses, submissions, test runtime, challenge answers | These are learning/submission workflows, not administrative edit pages. Their save/submission feedback has different semantics. |
| Gradebook and manual grading | Grade overrides, grading batches, regrade, release, deletion actions | These are specialized assessment transactions, often per learner or per page, and require domain-specific progress/confirmation rather than generic edit status. |
| Authentication/account activation | Login and activation forms | No previously saved editable draft exists in the page. |
| Read-only/detail pages | Subject detail, course overview, activity bank detail outside its inline editor, graph preview | No editable draft is present. |

## Shared implementation requirements for the later rollout

1. Extract a reusable action-bar primitive instead of copying the subject-specific markup and CSS.
2. Place the cross-plugin primitive in `@cognelo/activity-ui`; plugin authoring views must not import host-application components.
3. Drive the bar and `useUnsavedChangesGuard` from the same `isDirty`, save, discard, and busy state so their behavior cannot disagree.
4. Keep one action bar per genuine save boundary. Pages with multiple independent forms need multiple section-local bars or an explicitly designed aggregate transaction.
5. “Saved” means every operation owned by that bar completed successfully. Partial multi-request saves must remain dirty or surface a clear error.
6. Cancel restores the last successfully saved snapshot when the user remains on the page. Navigation controls may separately invoke the unsaved-changes guard.
7. Keep immediately persisted controls visually distinct and outside the bar's status scope.
8. Support long localized labels, narrow screens, safe-area insets, keyboard focus, disabled/busy states, and error announcements.
9. Add translations in the owning locale catalog. Plugin-owned wording remains plugin-local.
10. Test dirty-to-clean transitions, discard, failed/partial saves, guarded navigation, and narrow viewport behavior for each save boundary.

## Proposed implementation order

1. Create and document the shared `@cognelo/activity-ui` primitive, then migrate the subject reference without changing behavior.
2. Apply it to the already guarded host forms: course general settings, course AI settings, profile identity, and password change.
3. Apply it to core Test settings and the five plugin activity authoring views, updating every affected plugin's documentation and translations.
4. Add proper draft tracking to group settings, then adopt the bar there.
5. Decide separately whether AI agent settings and embedded/inline editors need a compact local variant.
6. Evaluate creation-form consistency as a distinct project rather than silently expanding this edit-page rollout.

## Inventory boundary

This inventory covers the current App Router pages and registered core/plugin authoring renderers. A new editable route or plugin authoring surface should be added here when introduced, together with its persistence boundary and dirty-state model.
