# Shared activity references and homework simulation

Status: implementation in progress, November 6, 2026.

## Requested behavior

- Activities opt into a core-owned Reference materials tab. The entire tree, readiness/preview/preparation UI and Save/Cancel boundary are shared, rather than implemented by each plugin.
- The teacher selects course content, including explicitly selected hidden resources. Visible preceding material remains the default; choosing a folder includes all descendants. Improve navigation/readability and preserve drafts across tabs.
- The embedding connection/model belongs to the course. Compatible existing material indexes/vectors remain reusable by every subscribing activity. Activity question-generation models remain independent.
- Coding Homework adds a teacher-only Simulation tab that generates sample challenge questions from the saved private teacher solution. It must not create student drafts, hand-ins, attempts or grades.

## Implementation boundaries

Core owns capability dispatch, reference tree/defaults, validation, course embedding-model configuration, readiness, index preparation and preview. Material plugins continue owning extraction/refresh through core; no sibling plugin imports or browser rendering in extraction. The host renders one consistent reference panel for subscribers. Plugin adapters only retain activity-specific selection/prepared snapshots and expose operational locks, preserving existing immutable homework records and copy semantics.

The course embedding setting uses validated core AI connection/model selection, with existing compatible defaults when unset. New preparation uses the course setting. Existing hand-ins and enabled workflows keep pinned snapshots; changing the course model requires new preparation for future disabled/unprepared activities and never rewrites academic history. Old activity-specific embedding choices cease being editable and remain only where needed by retained snapshots.

The reference panel has its own shared Save/Cancel bar and unsaved-change guard. Saving selection and preparing indexes are distinct operations. Preparation is cancellable, reports actual progress and preserves reusable completed indexes on failure. The UI includes folder collapse/expand, effective hidden labels, readable per-material readiness and saved-text inspection. It links to the course embedding setting instead of offering an activity-level model picker.

Simulation is a course-authoring operation, uses saved settings and the teacher solution, and shares the real question-generation algorithm (including provided-code exclusion, short-answer scope and teaching language). Results remain teacher-only and transient; they show questions with the relevant solution code and never reveal retrieved reference excerpts. Final submissions need not be enabled. Use prepared references when selected, and reject stale/unsaved prerequisites clearly. Include a blocking progress dialog with Cancel and reject late responses after cancellation.

## Delivery checkpoints

- [ ] Course-wide embedding model setting and resolver, preserving pinned history.
- [ ] Generic SDK/core activity-reference services and homework persistence adapter.
- [ ] Core reference UI with in-tab Save/Cancel, clearer tree/readiness and previews.
- [ ] Host Simulation tab and shared generation implementation without academic writes.
- [ ] Focused unit/E2E checks, existing-workflow regressions, documentation and incremental commits.

No production deployment or testing is authorized by this implementation request. Any compatibility assumptions and validation limits must be recorded before handoff.
