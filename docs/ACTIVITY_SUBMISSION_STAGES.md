# Activity submission stages

Status: implemented and validated, November 10, 2026.

## Safe Exam Browser per stage

Summative staged activities configure **Require Safe Exam Browser** independently inside each stage, with General → section → prioritized team → student inheritance and explicit false overrides. The activity-wide SEB control remains for ordinary activities. Activity and stage definitions may set `supportsSafeExamBrowser: false`; core omits unsupported controls, rejects attempts to enable them at any assignment level and ignores incompatible historic flags at access time. Omission preserves compatibility with existing SEB-capable activities. Disabled workflow stages retain their security settings without imposing access restrictions. Stage activation and SEB are independent: preparation before activation still requires SEB when that preparation stage is protected.

The optional `SubmissionStagePolicy.requireSafeExamBrowser` boolean is stored in the existing stage metadata maps. Older activity/section/team/student SEB settings continue protecting only the assessment stage; homework file preparation remains unrestricted. Reading or saving settings materializes compatible defaults and existing overrides, without rewriting submissions, starting attempts or requiring a database migration. New section assignments inherit General stage security unless explicitly overridden.

Mixed legacy and stage-specific SEB exceptions preserve the full team-priority/student order. Request-local, non-enumerable provenance reconciles those formats; never persist it or expose exception targets to learners. Explicit stage settings on one exception win over that same exception's legacy flag.

Plugins declare `submissionStageId` on routes owned by a stage. Core checks that declared stage's current SEB policy even when the route is marked `learnerAccessPhase: "preparation"`, and repeats the check after reading upload bodies. Unknown stages fail closed. Untagged guarded routes use the assessment stage; deferred resource/receipt routes may retain the explicit preparation exemption. Plugins never inspect SEB tokens, cookies, browser strings or configuration proofs. `SubmissionStageAccessGate` displays a protected-stage state and delegates launch to the host.

Programming Homework tags preparation/read-draft/hand-in as `files` and answering/answer saving as `questions`. Its file stage declares `supportsSafeExamBrowser: false` so students can upload local files in their regular browser. Only Questions answering offers an SEB setting. Assignment documents, provided-file downloads and read-only frozen work/downloads/checks remain accessible outside SEB. File-only homework requires no SEB. Other activities may protect supported stages or disallow SEB entirely. Background question generation and automatic saved-work recovery remain server-owned and start no SEB session or answer clock.

SEB authorization remains scoped to the user/course/section/activity configuration, which supplies the same restrictions for all stages. A verified session therefore satisfies either protected stage without another launch. Requiring SEB in one stage does not gate an unprotected stage. Existing ordinary activity restrictions, content closure, staff bypass and attempt timing remain in force.

Validation includes the generic stage security matrix, activity/stage opt-outs, legacy defaults and inherited exceptions, scoped proof reuse and ordinary guards. Local browser coverage checks homework answering with/without SEB, unsupported file-stage rejection, General/section/student controls, old configurations, file-only individual/team work, the 30-student FIFO queue, ordinary launch behavior, activation and scheduling. This follow-up adds no migration or environment setting.

## Stage activation follow-up

Implementation and regression validation are complete. Core Activity settings owns a separate activation switch for every declared submission stage, with the ordinary General/section/team/student inheritance. A plugin's workflow option (such as Generate challenge questions) determines which stages apply; activation independently controls when students may begin them. Teachers can configure an inactive stage in advance. Student stage actions stay visible but disabled with an Awaiting teacher activation status.

Draft file preparation remains available before file hand-in activation. File hand-in may be activated while question generation remains closed: files freeze normally and wait without AI calls or answering time. Activating the question stage releases waiting work through the bounded durable queue. Turning it off blocks new generation/answering starts; already-started answering attempts may finish under their existing timing. Activation never extends calendar cutoffs or restarts a stage clock.

New course activities and copies start with explicit inactive stage flags. Historical records without flags retain their prior behavior. Core invokes plugin readiness and transactional activation hooks through the shared server contract; only the plugin interprets or queues its private submissions. No plugin talks directly to another plugin.

- [x] Shared contract, inheritance, generic hooks and start enforcement.
- [x] Programming Homework waiting/release workflow, individual/team/cancellation support.
- [x] Shared teacher controls, student inactive actions and localized statuses.
- [x] Unit/API/E2E regressions, docs and incremental commits.

## Accepted behavior

Plugins may declare ordered submission stages, including the first stage, using stable IDs and localized names. Core owns the scheduling UI, deadlines, optional stage time limits, and assignment inheritance. Plugins own evidence, stage transitions and jobs; core never reads plugin tables directly.

Each stage deadline and the overall Available until cutoff are optional. The effective calendar deadline is the earlier configured date, the sole configured date, or absent when both are absent. A stage duration starts with that stage, and further caps its effective end. Available until remains a hard cap across all stages. Waiting for question generation consumes no answering time.

Programming Homework advertises File submission and Questions answering. With questions disabled only File submission is active. Existing homework deadlines/late policy and existing answering limits must remain effective during upgrade. Move deadline/late scheduling out of plugin authoring and into the shared assignment settings alongside availability. Core supplies localized effective-deadline explanations. Section/team/student exceptions use the existing assignment mechanism. Ordinary activity types retain their current dates/timing.

Late hand-in may extend a stage's own due date, but never the overall cutoff or stage duration. Lateness measures from the due date, not from the end of the allowance. Automatic prepared-work recovery uses the finite effective file cutoff and preserves incomplete-work acknowledgement, team identity, cancellation suppression and immutable historical timing.

Scheduling background explanations use shared help immediately after the relevant heading, deadline label or duration toggle on the same line. Disabled-stage help stays accessible in its legend. Current effective deadlines remain visible; timezone names appear only in configuration choosers. See [contextual help](CONTEXTUAL_HELP.md).

## Implementation assumptions

- Scheduling configuration is stored as generic assignment metadata, with a plugin service supplying legacy defaults and active-stage configuration. Saving shared settings materializes those defaults in core; explicit null clears a saved field.
- Stage schedule overrides are independently merged by stage/field under General → section → prioritized team → student rules.
- File preparation duration, when configured, starts on the first accepted file upload while the stage is active, or on activation for an existing nonempty draft; no academic attempt is created. Question duration starts at explicit Answer and uses the existing core attempt.
- Active stage timers retain their start across navigation, refresh and policy edits. Teacher cancellation or deletion of the latest individual hand-in permits a fresh preparation stage; reopening answers preserves the frozen code and original answering start.
- Stage names and count come from the declared list. Workflow-disabled stages retain their saved configuration. Teacher deactivation leaves schedule controls editable for preparation but prevents new student starts.

## Checkpoints

- [x] SDK/schema and pure core scheduling resolver with exhaustive date/duration/late matrices.
- [x] Core settings persistence, inheritance, effective timing and API coverage.
- [x] Homework legacy compatibility, file/answer enforcement, automatic recovery and UI removal.
- [x] Shared scheduling UI and course-timezone handling.
- [x] Local E2E combinations, ordinary-activity regressions, documentation and incremental commits.

Functional acceptance uses isolated local data. Production testing remains prohibited under the standing operator rule.

## Compatibility and persistence

Core stores General stage settings under `Activity.metadata.allGroupsAssignment.submissionStages`; materialized section metadata stores effective `submissionStages` and explicit `submissionStageOverrides`. Exception `submissionStages` maps override only supplied stage fields, independently of legacy overrideFields. Explicit null removes a date/duration. Existing generic General and section/team/student answering limits are translated into the assessment stage, including their override precedence. The shared form retires the old generic time-limit override when saving the equivalent stage field; clearing a canonical stage override restores inheritance. Disabled answering stages ignore legacy answering timers. Plugin defaults are resolved through its server capability, never SQL in core. Homework legacy policy is read until replaced by an explicit core field; compatibility endpoint writes are transactional core writes, not new private policy. Final submission timing stays immutable. Core submission history snapshots the effective stage cutoff, stage ID and separate due date (archiving and clearing those snapshots on reopening), so a permitted late window does not change the recorded lateness baseline. New section placements also inherit General stage policy when checking attempt allowance. Stage dates reset with course-specific assignment settings on duplication.

The plugin-only additive migration `202611090020_submission_stage_clocks` adds private preparation-start timestamps and backfills legacy nonempty drafts/workspaces without explicit activation flags. Repeated migration must leave inactive-stage drafts unstarted. It does not rewrite submitted work or grades. No environment variable changes.

## Backend checkpoint

The date/duration/late matrix and capability/default tests pass. Local API acceptance covers all six optional-date combinations, an earlier global cutoff, explicit null, section/student inheritance, unknown-stage rejection, student denial and legacy endpoint delegation. Real individual/team file-only hand-ins, first-upload timers, no reset after file removal, automatic incomplete recovery and cancellation pass. Browser acceptance also covers the shared scheduling form and actual explicit answering across six date/duration configurations. The final regression and UI handoff are recorded below.

## Final acceptance

The shared Settings → General panel places availability beside named stage deadlines, durations and supported late controls. It shows the effective calendar deadline, makes inherited-field overrides explicit, and retains disabled stages. Homework Submission settings links directly to this dialog and no longer has a deadline form. File/answer stages, expiry handling, content closure and learner conversation timing resolve the same core assessment policy. Preparation clocks survive reload/removal, and teacher cancellation or deletion of the latest individual submission resets preparation without changing historical evidence.

Validation passed: 2,043 unit tests across 341 files; all workspace typechecks and plugin boundary checks; 27 distinct local API/E2E scenarios. The focused scheduling tests cover every own/global date presence/order combination, equal dates, duration/no-duration, late/no-late/bounded/unbounded behavior, first-stage timers and automatic incomplete recovery for individuals/teams, saved-only answers after stage expiry, disabled-question retention, inheritance/null clearing, malformed/unknown stages, authorization, legacy defaults/new core writes and transactional rollback. Regressions cover ordinary MCQ/programming/Web Design/Parsons routes, compound Test deadlines/closure, duplication, released/read-only access, editor Save/Cancel, late timestamps and the existing homework queue/workflow. Desktop/mobile scheduling screenshots were inspected. Focused lint has no errors and one existing legacy answering-effect warning. Fixture providers validate delivery and policy rather than real AI output quality.

The additive private clock migration was applied locally; no production operations or environment changes were made. Backend slice: `ddb6452`; the following shared UI/acceptance commit completes this delivery. Root/plugin orientation, authoring handbook, assignment/content-access and homework canonical documents were reviewed and updated, with no documentation verification gap.

## Activation acceptance

Shared contract/defaults, inherited section/student activation, manager authorization and transactional rejection are covered. Homework acceptance covers preparation before activation, immutable file hand-in without references while questions wait, later FIFO release, missing-readiness rollback, reopening without regeneration, existing answering continuation, common/separate team questions, late-joining activated members, individual reset and repeated clock backfill. A controlled in-flight provider test closes the stage mid-set, verifies no partial publication or consumed retry, and then resumes successfully. Existing closed/unprepared homework remains editable after upgrade.

The complete regression run and focused optimized-build checks cover all activity types and the exam date/duration matrix, including 180-minute sessions, early/late starts, extended accommodations, section/team/student precedence, exclusions and saved-answer timeout recovery. Private operational evidence stays outside the checkout. Activation adds no new schema migration beyond the previously documented stage-clock migration.
