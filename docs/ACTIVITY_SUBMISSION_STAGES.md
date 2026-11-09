# Activity submission stages

Status: implementation in progress, November 9, 2026.

## Accepted behavior

Plugins may declare ordered submission stages, including the first stage, using stable IDs and localized names. Core owns the scheduling UI, deadlines, optional stage time limits, and assignment inheritance. Plugins own evidence, stage transitions and jobs; core never reads plugin tables directly.

Each stage deadline and the overall Available until cutoff are optional. The effective calendar deadline is the earlier configured date, the sole configured date, or absent when both are absent. A stage duration starts with that stage, and further caps its effective end. Available until remains a hard cap across all stages. Waiting for question generation consumes no answering time.

Programming Homework advertises File submission and Questions answering. With questions disabled only File submission is active. Existing homework deadlines/late policy and existing answering limits must remain effective during upgrade. Move deadline/late scheduling out of plugin authoring and into the shared assignment settings alongside availability. Core supplies localized effective-deadline explanations. Section/team/student exceptions use the existing assignment mechanism. Ordinary activity types retain their current dates/timing.

Late hand-in may extend a stage's own due date, but never the overall cutoff or stage duration. Lateness measures from the due date, not from the end of the allowance. Automatic prepared-work recovery uses the finite effective file cutoff and preserves incomplete-work acknowledgement, team identity, cancellation suppression and immutable historical timing.

## Implementation assumptions

- Scheduling configuration is stored as generic assignment metadata, with a plugin service supplying legacy defaults and active-stage configuration. Saving shared settings materializes those defaults in core; explicit null clears a saved field.
- Stage schedule overrides are independently merged by stage/field under General → section → prioritized team → student rules.
- File preparation duration, when configured, starts on the first accepted file upload; no academic attempt is created. Question duration starts at explicit Answer and uses the existing core attempt.
- Active stage timers retain their start across navigation, refresh and policy edits. Teacher reopening/cancellation permits a fresh preparation stage.
- Stage names and count come from the declared list. Inactive stages retain saved configuration without exposing controls or starting timers.

## Checkpoints

- [x] SDK/schema and pure core scheduling resolver with exhaustive date/duration/late matrices.
- [x] Core settings persistence, inheritance, effective timing and API coverage.
- [x] Homework legacy compatibility, file/answer enforcement, automatic recovery and UI removal.
- [ ] Shared scheduling UI and course-timezone handling.
- [ ] Local E2E combinations, ordinary-activity regressions, documentation and incremental commits.

All functional tests use local disposable data. No production actions are authorized by this work.

## Compatibility and persistence

Core stores General stage settings under `Activity.metadata.allGroupsAssignment.submissionStages`; materialized section metadata stores effective `submissionStages` and explicit `submissionStageOverrides`. Exception `submissionStages` maps override only supplied stage fields, independently of legacy overrideFields. Explicit null removes a date/duration. Plugin defaults are resolved through its server capability, never SQL in core. Homework legacy policy is read until replaced by an explicit core field; compatibility endpoint writes are transactional core writes, not new private policy. Final submission timing stays immutable. Stage dates reset with course-specific assignment settings on duplication.

The plugin-only additive migration `202611090020_submission_stage_clocks` adds private preparation-start timestamps and backfills nonempty drafts/workspaces. It does not rewrite submitted work or grades. No environment variable changes.

## Backend checkpoint

The date/duration/late matrix and capability/default tests pass. Local API acceptance covers all six optional-date combinations, an earlier global cutoff, explicit null, section/student inheritance, unknown-stage rejection, student denial and legacy endpoint delegation. Real individual/team file-only hand-ins, first-upload timers, no reset after file removal, automatic incomplete recovery and cancellation pass. Browser acceptance also covers the shared scheduling form and actual explicit answering across six date/duration configurations. Further regressions and the complete documentation/UI handoff are in progress.
