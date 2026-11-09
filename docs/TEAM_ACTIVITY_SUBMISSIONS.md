# Team activities and homework hand-in

Status: implemented and locally validated November 5, 2026. This supersedes the individual-only scope for Coding Homework while preserving individual mode as the default.

## Approved behavior

- An activity definition explicitly advertises support for teamwork. Core Activity settings shows Team work only for capable activities. Core Assignment settings selects a grouping for each assigned section and independently controls whether unteamed students may submit individually.
- Homework authoring owns **Generate separate challenge questions for each team member**. Unchecked means one shared question set per team with private individual answers; checked means independent generation for each member, without cross-member uniqueness checks.
- Current teammates share one persistent preparation workspace. Any member may upload, replace or remove files, run structural checks and submit for the whole team. Every file change records actor, operation, affected path, time and relevant file/revision metadata. Existing confirmation, ZIP-replacement, upload safety and revision-conflict rules continue to apply.
- A team hand-in freezes one shared file collection. All members count as having handed in; each answers challenges separately with their own timer, SEB checks, answers, attempt and grade. The teacher can later edit any grade individually. A future grading mechanism may apply a common initial result to members through their individual grade records; automatic code execution/grading is not introduced by this feature.
- Joining a team after its hand-in grants the new member that team's workspace and an individual challenge participation. The teacher controls the permitted team-change window through existing grouping settings.
- Changing/leaving teams starts a new participation in the destination workspace: old files, answers, answering progress and active grades do not carry over. Old-team access is revoked server-side. Empty teams lose their preparation and submitted-work contents, including obsolete shared files. Minimal actor/action/grade audit evidence is retained, not an accessible copy of the erased submission.
- Teacher cancellation cancels the shared hand-in for everyone, withdraws associated active grades and reopens shared preparation. **Reset this student's challenges** affects only that student's answering participation while retaining the shared code.
- Team mode, grouping/individual-permission choices and shared/separate question policy cannot change while affected active hand-ins exist. Teachers cancel the affected hand-ins first. Ordinary live availability, timing and assignment-exception rules remain core-owned.
- **Download submitted work** returns a ZIP of frozen submitted files with folders preserved, for both individual and team submissions. Members may rerun read-only static checks on the frozen work. Validation remains structural, not evidence of correctness.

## Implementation constraints and choices

Core remains plugin-neutral. Capability-scoped lifecycle handlers expose private hand-in locks and react to membership changes through the host transaction, using the SDK's neutral query/execute pattern. Core resolves membership and owns assignment/grade effects; the Homework plugin owns its workspace, file audit, frozen artifact and question data. Plugins never import sibling implementations.

The user confirmed that no real student submissions exist yet; no academic-data backfill is required for this delivery. Keep one physical frozen file collection per shared hand-in, with independent student question/answer records. The default individual workflow must pass its current regression suite. Membership changes and hand-in synchronize with grouping/workspace locks; late generation or stale file reads cannot restore access to an old workspace. Filesystem cleanup is idempotent and recoverable after the owning database transaction commits.

Resetting one student's challenges reuses the team's shared question set when common questions are selected, and generates a fresh set when separate questions are selected. It starts a new individual answering participation; previous active grades are withdrawn and audit evidence retained. Grouping visibility continues to govern roster/name disclosure. Students without an activated account are considered covered by the team's hand-in; individual answering becomes available after activation. Unteamed submissions use an independent personal workspace only when the section permits them. Otherwise the page shows the assignment documents/provided files and a clear team-membership notice, without preparation, checking or submission controls. No private workspace is created, and preparation/file/hand-in requests are rejected server-side until the student joins a team.

## Core extension

`ActivityDefinition.supportsTeamwork` is an explicit opt-in. The `ServerActivityPlugin.teamwork` service reports active hand-ins and handles grouping membership changes using the host’s neutral SQL transaction. It may enqueue durable plugin jobs and identify scoped attempts to withdraw; it must not call AI or remote services inside the transaction. Core resolves actual enrollment/team membership and validates assignment groupings against the section. Private plugin table names never enter core. Core settings and lifecycle integration are implemented. The Homework service owns shared workspaces, frozen files and per-student participation; local end-to-end validation is complete. General/Assignment fields cannot be overwritten by the generic activity editor. Direct section assignment endpoints enforce the same policy locks. Roster removal and section deletion/moves dispatch membership cleanup before enrollment cascades. Generic gradebook deletion directs team hand-ins to the explicit reset/cancel actions.

## Delivery checkpoints

- [x] Core capability, assignment contracts/UI, grouping validation and active-hand-in locks.
- [x] Transactional membership lifecycle and current-workspace authorization.
- [x] Shared preparation, file audit, frozen hand-in and late-join handling.
- [x] Shared/separate questions with private answers, individual timers/grades and reset behavior.
- [x] Whole-team cancellation, empty-team erasure and recoverable file cleanup.
- [x] Frozen-work ZIP download and read-only structural checks.
- [x] Local migration validation, focused unit/integration/E2E checks and individual-workflow regression.
- [x] Updated canonical documentation and validated incremental commits.

No production migration or deployment is authorized by this implementation request. Production functional testing remains prohibited; use local or isolated preprod.

Membership changes record a core audit event containing the grouping revision, affected enrollment IDs and newly empty team IDs. Its ID is the participation token; the latest empty-team event defines the workspace generation. Plugins bind private state to those tokens so leaving and rejoining cannot resurrect a prior answering participation or an erased team workspace. No-op team renaming does not change tokens. Team mutations include a workspace/member context key as well as the draft revision, preventing delayed requests from applying to a different team whose draft happens to have the same revision.

## Validation and handoff

Local migration and Prisma schema validation passed. The final focused unit suite passed 250 tests. Workspace-wide type checks and plugin-boundary checks passed. Thirteen distinct local E2E scenarios passed across the regression and settings runs: shared/separate team questions and lifecycle; two-section grouping/unteamed configuration; individual hand-in and timeout; blank answers; prepared/submitted file explorers; SEB activation; the 30-student bounded queue; and student team choice. Team checks also verify delayed old-context uploads are rejected and empty-team physical files are cleaned up. Settings and learner screenshots were inspected. The model boundary is synthetic and privately scoped to disposable test courses; these tests do not claim real-provider generation quality.

The local development schema is ready. No production migration/deployment was performed. The default remains individual delivery; enable Team work and select section groupings to test teams. The plugin exposes common questions by default, with the separate-question checkbox in its Settings tab. Root/plugin navigation, memories, core-services contract and workflow references were reviewed and updated; no affected documentation remains unverified.

File-only deferred work may record completed attempts during `membershipChanged` through the transaction-bound `recordDeferredSubmission` capability. Core withdraws previous membership attempts/overrides before invoking the plugin, then handles its explicit old-attempt IDs; do not rescan and withdraw the new participation after the callback. This keeps late joins and moves atomic while preserving individual grade ownership.
