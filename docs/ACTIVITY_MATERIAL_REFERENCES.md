# Shared activity references and homework simulation

Status: implemented and locally validated, November 6, 2026.

## Requested behavior

- Activities opt into a core-owned Reference materials tab. The entire tree, readiness/preview/preparation UI and Save/Cancel boundary are shared, rather than implemented by each plugin.
- The teacher selects course content, including explicitly selected hidden resources. Visible preceding material remains the default; choosing a folder includes all descendants. Improve navigation/readability and preserve drafts across tabs.
- The embedding connection/model belongs to the course. Compatible existing material indexes/vectors remain reusable by every subscribing activity. Activity question-generation models remain independent.
- Programming Homework adds a teacher-only Simulation tab that generates sample challenge questions from a teacher-uploaded, checked ZIP. It must not create student drafts, hand-ins, attempts or grades.

## Implementation boundaries

Core owns capability dispatch, reference tree/defaults, validation, course embedding-model configuration, readiness, index preparation and preview. Material plugins continue owning extraction/refresh through core; no sibling plugin imports or browser rendering in extraction. The host renders one consistent reference panel for subscribers. Plugin adapters only retain activity-specific selection/prepared snapshots and expose operational locks, preserving existing immutable homework records and copy semantics.

The course embedding setting uses validated core AI connection/model selection, with existing compatible defaults when unset. New preparation uses the course setting. Existing hand-ins and enabled workflows keep pinned snapshots; changing the course model requires new preparation for future disabled/unprepared activities and never rewrites academic history. Old activity-specific embedding choices cease being editable and remain only where needed by retained snapshots.

The reference panel has its own shared Save/Cancel bar and unsaved-change guard. Saving selection and preparing indexes are distinct operations. Preparation is cancellable, reports actual progress and preserves reusable completed indexes on failure. The UI includes folder collapse/expand, effective hidden labels, readable per-material readiness and saved-text inspection. It links to the course embedding setting instead of offering an activity-level model picker.

Simulation is a course-authoring operation, uses saved settings and the checked ZIP, and shares the real question-generation algorithm (including provided-code exclusion, short-answer scope and teaching language). Results remain teacher-only and transient; they show questions with the relevant solution code and never reveal retrieved reference excerpts. Final submissions need not be enabled. Use prepared references when selected, and reject stale/unsaved prerequisites clearly. Include a blocking progress dialog with Cancel and reject late responses after cancellation.

## Delivery checkpoints

- [x] Course-wide embedding model setting and resolver, preserving pinned history.
- [x] Generic SDK/core activity-reference services and homework persistence adapter.
- [x] Core reference UI with in-tab Save/Cancel, clearer tree/readiness and previews.
- [x] Host Simulation tab and shared generation implementation without academic writes.
- [x] Focused unit/E2E checks, existing-workflow regressions, documentation and incremental commits.

No production deployment or testing is authorized by this implementation request. Any compatibility assumptions and validation limits must be recorded before handoff.

## Core capability and routes

A course activity declares `ActivityDefinition.usesMaterialEmbeddings: true` and registers `ServerActivityPlugin.materialReferences` for its explicit `activityTypeKeys`. Core verifies course management, activity/course ownership, plugin availability and the capability before dispatch. The adapter reads/writes only its private selected IDs, immutable prepared snapshot and operational lock; `read` acquires its settings lock, and core supplies the same parameterized transaction to `write`. Core never imports or queries the consumer's private tables.

Core builds the course-content tree, resolves default visible preceding materials, validates selected resources, checks readiness and publishes the prepared selection through the adapter. Section-only materials are outside this course-scoped list. Prepared snapshots contain selected resource IDs, immutable index IDs, embedding selection/endpoint identity, preparation time and the authorizing manager for the explicitly hidden subset. `createPreparedActivityReferenceSearch` rechecks that manager's current access for hidden indexes while retaining learner authorization for visible/legacy references. It never grants students direct access to hidden material.

All routes below require course management and use the normal authenticated API/CSRF boundary:

| Route | Behavior |
| --- | --- |
| `GET/PUT /api/courses/:courseId/material-embedding-settings` | Read or save the shared embedding connection/model; no credentials enter the response. |
| `GET/PUT /api/courses/:courseId/activities/:activityId/material-references` | Shared tree/readiness or revision-checked selection save. |
| `POST .../material-references/prepare-material` | Prepare one saved selected resource through its material plugin; abortable, reusable completed indexes. |
| `POST .../material-references/prepare` | Verify all selected indexes and atomically pin the prepared snapshot. |
| `GET .../material-references/preview` | Paginated exact saved text for a resource; pinned version when present. |

The shared host mounts the panel for the capability; a plugin does not supply a reference renderer or duplicate these routes. `useActivityReferenceAuthoring` exposes loaded/dirty/prepared/revision state to dependent settings or simulation controls. Folder expansion uses the existing local-storage policy (collapsed by default, four-hour expiry). Search reveals matching branches without rewriting that preference. Returning to the Reference materials tab refreshes readiness/operational locks while preserving unsaved selection, so opening or closing submissions in a plugin section does not leave stale controls. The shared `EditActionBar` saves/discards the selection independently from other activity drafts; uploads and reference generation remain explicit actions.

## Course model and compatibility

`CourseMaterialEmbeddingSettings` stores one validated selection per course, separately from student-support/feedback AI settings so saving either form cannot overwrite the other. Saving records a `course_material_embedding_model_updated` audit event. Selection is limited to an enabled own/shared embedding-capable connection; a stored course choice preserves authorized owner consent and endpoint identity. With no explicit selection, the existing course staff embedding default remains compatible.

New preparation and generic material calls without an explicit historical selection use this course setting. Readiness for an unlocked activity compares its prepared model and selected current indexes against the course setting. Changing the course model therefore requires preparation before future opening, reusing any compatible indexes/vectors. Enabled homework and existing hand-ins retain their pinned selection; changing a course model never rewrites submitted work. The panel shows the pinned model separately when an enabled activity uses a previous model. Disabling and reopening requires current course-model readiness.

Homework retains its existing private selection/snapshot schema through its adapter. Legacy plugin selection/preparation/preview routes delegate to core. New per-homework `embeddingAi` writes reject with `COURSE_EMBEDDING_SETTINGS_REQUIRED`; old fields survive only for pinned-record compatibility. Same-course duplicates inherit the same course model and clone the source's prepared references; moving between courses does not transplant references.

Migration: apply `202611060001_course_material_embedding_settings` using `npm run db:migrate:all`, then regenerate clients with `npm run db:generate`. This adds the course-owned settings table; it does not rewrite existing selections, indexes, credentials or student records. No environment variable changes.

## Homework simulation

The November 9 [Programming Homework editor contract](PROGRAMMING_HOMEWORK_EDITOR.md) supersedes the original teacher-solution Simulation design. Simulation is now a left section within Activity, uses only a same-teacher/course preflight ZIP, and requires explicit simulated hand-in plus incomplete-work acknowledgement when needed. It shares the actual generator and prepared references, retains course teaching language and provided-code exclusion, and creates no student attempt or grade. The core Reference materials tab remains on top, independent of the activity's left navigation. Question-free hand-in/simulation does not require reference preparation, while the reference UI remains available.

## Validation and assumptions

- Full unit suite: 337 files / 1,942 tests passed. All workspace typechecks, plugin boundary checks and API/web production builds passed. Focused lint has no errors; three existing warnings remain in the shared editor/legacy homework renderer.
- Twenty-one distinct local E2E scenarios passed across the reference/simulation and existing-workflow runs. Coverage includes independent Save/Cancel/draft retention, compact checkboxes, preparation cancellation, hidden-reference privacy, exact text previews, cross-activity index reuse, course-model invalidation and pinned enabled references, duplication, incomplete/complete hand-ins, named extraction failures/retry, Codex/Ollama model choices, other text-provider rubric generation, SEB, the 30-student queue and both team question policies.
- Simulation checks cover saved instructions, course French despite an English session, provided-code exclusion, private retrieved text, aborting further generation, no student records, preserved results across tabs, unsaved instruction/model blocking and a subsequent real hand-in using the shared generator. Unit checks also reject changed saved inputs and overlapping simulation requests. Desktop/mobile screenshots were inspected; no page-width overflow was found.
- AI E2Es use isolated disposable accounts/course data and local provider fixtures. They validate integration and prompt/configuration delivery, not the pedagogical quality of real model output. No shared AI preferences were replaced and no production tests/deployment were performed.
- Authorized assumptions: Simulation is course-only, uses a checked ZIP with saved configuration and any required prepared references, and keeps results transient. An absent explicit course model preserves the existing staff default. Already enabled work retains its previous prepared references; disabled work must prepare against the current course model. Material extraction stays plugin-owned and never launches a browser.

The root README/memory/architecture/index, shared material/model contracts, plugin-authoring handbook and homework README/memory/reference/workflow/progress were reviewed and updated. Material plugin extraction contracts remain unchanged and their orientation/reference documents remain accurate. No documentation verification gap remains.

Activities own their operational reference lock through the persistence adapter; the shared panel and errors describe a workflow lock without assuming a final-file-submission switch. Programming Homework locks references when Questions answering is activated, allowing preparation while only File submission is active.
