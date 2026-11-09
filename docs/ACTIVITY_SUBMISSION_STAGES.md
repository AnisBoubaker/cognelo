# Activity submission stages

Status: implemented and locally validated, November 9, 2026.

## Accepted behavior

Plugins may declare ordered submission stages, including the first stage, using stable IDs and localized names. Core owns the scheduling UI, deadlines, optional stage time limits, and assignment inheritance. Plugins own evidence, stage transitions and jobs; core never reads plugin tables directly.

Each stage deadline and the overall Available until cutoff are optional. The effective calendar deadline is the earlier configured date, the sole configured date, or absent when both are absent. A stage duration starts with that stage, and further caps its effective end. Available until remains a hard cap across all stages. Waiting for question generation consumes no answering time.

Programming Homework advertises File submission and Questions answering. With questions disabled only File submission is active. Existing homework deadlines/late policy and existing answering limits must remain effective during upgrade. Move deadline/late scheduling out of plugin authoring and into the shared assignment settings alongside availability. Core supplies localized effective-deadline explanations. Section/team/student exceptions use the existing assignment mechanism. Ordinary activity types retain their current dates/timing.

Late hand-in may extend a stage's own due date, but never the overall cutoff or stage duration. Lateness measures from the due date, not from the end of the allowance. Automatic prepared-work recovery uses the finite effective file cutoff and preserves incomplete-work acknowledgement, team identity, cancellation suppression and immutable historical timing.

## Implementation assumptions

- Scheduling configuration is stored as generic assignment metadata, with a plugin service supplying legacy defaults and active-stage configuration. Saving shared settings materializes those defaults in core; explicit null clears a saved field.
- Stage schedule overrides are independently merged by stage/field under General → section → prioritized team → student rules.
- File preparation duration, when configured, starts on the first accepted file upload; no academic attempt is created. Question duration starts at explicit Answer and uses the existing core attempt.
- Active stage timers retain their start across navigation, refresh and policy edits. Teacher cancellation or deletion of the latest individual hand-in permits a fresh preparation stage; reopening answers preserves the frozen code and original answering start.
- Stage names and count come from the declared list. Inactive stages retain saved configuration without exposing controls or starting timers.

## Checkpoints

- [x] SDK/schema and pure core scheduling resolver with exhaustive date/duration/late matrices.
- [x] Core settings persistence, inheritance, effective timing and API coverage.
- [x] Homework legacy compatibility, file/answer enforcement, automatic recovery and UI removal.
- [x] Shared scheduling UI and course-timezone handling.
- [x] Local E2E combinations, ordinary-activity regressions, documentation and incremental commits.

All functional tests use local disposable data. No production actions are authorized by this work.

## Compatibility and persistence

Core stores General stage settings under `Activity.metadata.allGroupsAssignment.submissionStages`; materialized section metadata stores effective `submissionStages` and explicit `submissionStageOverrides`. Exception `submissionStages` maps override only supplied stage fields, independently of legacy overrideFields. Explicit null removes a date/duration. Existing generic General and section/team/student answering limits are translated into the assessment stage, including their override precedence. The shared form retires the old generic time-limit override when saving the equivalent stage field; clearing a canonical stage override restores inheritance. Disabled answering stages ignore legacy answering timers. Plugin defaults are resolved through its server capability, never SQL in core. Homework legacy policy is read until replaced by an explicit core field; compatibility endpoint writes are transactional core writes, not new private policy. Final submission timing stays immutable. Core submission history snapshots the effective stage cutoff, stage ID and separate due date (archiving and clearing those snapshots on reopening), so a permitted late window does not change the recorded lateness baseline. New section placements also inherit General stage policy when checking attempt allowance. Stage dates reset with course-specific assignment settings on duplication.

The plugin-only additive migration `202611090020_submission_stage_clocks` adds private preparation-start timestamps and backfills nonempty drafts/workspaces. It does not rewrite submitted work or grades. No environment variable changes.

## Backend checkpoint

The date/duration/late matrix and capability/default tests pass. Local API acceptance covers all six optional-date combinations, an earlier global cutoff, explicit null, section/student inheritance, unknown-stage rejection, student denial and legacy endpoint delegation. Real individual/team file-only hand-ins, first-upload timers, no reset after file removal, automatic incomplete recovery and cancellation pass. Browser acceptance also covers the shared scheduling form and actual explicit answering across six date/duration configurations. The final regression and UI handoff are recorded below.

## Final acceptance

The shared Settings → General panel places availability beside named stage deadlines, durations and supported late controls. It shows the effective calendar deadline, makes inherited-field overrides explicit, and retains disabled stages. Homework Submission settings links directly to this dialog and no longer has a deadline form. File/answer stages, expiry handling, content closure and learner conversation timing resolve the same core assessment policy. Preparation clocks survive reload/removal, and teacher cancellation or deletion of the latest individual submission resets preparation without changing historical evidence.

Validation passed: 2,043 unit tests across 341 files; all workspace typechecks and plugin boundary checks; 27 distinct local API/E2E scenarios. The focused scheduling tests cover every own/global date presence/order combination, equal dates, duration/no-duration, late/no-late/bounded/unbounded behavior, first-stage timers and automatic incomplete recovery for individuals/teams, saved-only answers after stage expiry, disabled-question retention, inheritance/null clearing, malformed/unknown stages, authorization, legacy defaults/new core writes and transactional rollback. Regressions cover ordinary MCQ/programming/Web Design/Parsons routes, compound Test deadlines/closure, duplication, released/read-only access, editor Save/Cancel, late timestamps and the existing homework queue/workflow. Desktop/mobile scheduling screenshots were inspected. Focused lint has no errors and one existing legacy answering-effect warning. Fixture providers validate delivery and policy rather than real AI output quality.

The additive private clock migration was applied locally; no production operations or environment changes were made. Backend slice: `ddb6452`; the following shared UI/acceptance commit completes this delivery. Root/plugin orientation, authoring handbook, assignment/content-access and homework canonical documents were reviewed and updated, with no documentation verification gap.
