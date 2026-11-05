# Team activities and homework hand-in

Status: approved November 5, 2026; implementation in progress. This supersedes the individual-only scope for Coding Homework while preserving individual mode as the default.

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

Keep one physical frozen file collection per shared hand-in, with independent student question/answer records. Existing individual submissions remain readable and the default individual workflow must pass its current regression suite. Membership changes and hand-in synchronize with grouping/workspace locks; late generation or stale file reads cannot restore access to an old workspace. Filesystem cleanup is idempotent and recoverable after the owning database transaction commits.

Resetting one student's challenges reuses the team's shared question set when common questions are selected, and generates a fresh set when separate questions are selected. It starts a new individual answering participation; previous active grades are withdrawn and audit evidence retained. Grouping visibility continues to govern roster/name disclosure. Students without an activated account are considered covered by the team's hand-in; individual answering becomes available after activation. Unteamed submissions use an independent personal workspace when the section permits them.

## Delivery checkpoints

- [ ] Core capability, assignment contracts/UI, grouping validation and active-hand-in locks.
- [ ] Transactional membership lifecycle and current-workspace authorization.
- [ ] Shared preparation, file audit, frozen hand-in and late-join handling.
- [ ] Shared/separate questions with private answers, individual timers/grades and reset behavior.
- [ ] Whole-team cancellation, empty-team erasure and recoverable file cleanup.
- [ ] Frozen-work ZIP download and read-only structural checks.
- [ ] Local migration validation, focused unit/integration/E2E checks and individual-workflow regression.
- [ ] Updated canonical documentation and validated incremental commits.

No production migration or deployment is authorized by this implementation request. Production functional testing remains prohibited; use local or isolated preprod.
