# Activity logs and student actions

Every teacher activity report has **Class overview**, **Student results**, and **Logs** tabs, whether entered from Content or Gradebook. Content still opens Class overview by default. Logs and editor return links preserve the activity, origin and optional section. The separate Programming Homework Student submissions panel is removed. Cancellation and challenge reset live in each student's shared three-dot menu, alongside grading, reopening, deletion and downloads.

## Recorded history

Logs combine retained core attempt start/submission timestamps and grade audit events with optional activity-owned lifecycle evidence. They include formative and summative work, deleted attempts, grade changes/release/hiding, feedback recording, reopening and assessment-mode changes. Reopening clears the live submission timestamp, so its earlier completion is recovered from the immutable reopening audit snapshot. Current account names are resolved at read time, with enrollment fallback.

Programming Homework additionally projects file hand-ins before core attempts exist, automatic hand-ins, teacher cancellation, individual challenge resets, question readiness and retained processing failure timestamps. A reset is not another file hand-in. Shared-work submission actors come from the retained workspace audit; unknown actors stay unnamed. The log displays teacher reasons but never raw model/provider errors, source files, questions/answers, private metadata or grade snapshots.

This is a projection of evidence already retained by the application, not a new telemetry recorder or a server-console viewer. It cannot reconstruct events erased before the feature existed or private workspace records removed under the established retention rules. Low-level keystrokes, every presence heartbeat and provider request bodies are outside this view.

## Reading and paging

`GET /api/courses/:courseId/gradebook/activities/:activityId/logs` accepts optional `groupId` and a bounded JSON `cursor` of `{at,id}`. It returns 50 entries and `nextCursor`, newest first with deterministic ID ordering for equal timestamps. Each evidence source applies the same cursor before its own bounded query; the host merges, deduplicates and paginates. Refresh reloads the newest page; Load older events appends history. Loading errors retain already displayed entries.

Core requires gradebook capability, derives the authorized current student roster from actual assignments and applies section-staff restrictions before reading any evidence. Foreign sections/enrollments and learners are rejected. The host filters plugin evidence against that roster and explicitly projects public fields, then resolves actor names. Logs reads perform no timeout/hand-in recovery, generation, grading or draft/attempt creation.

## Activity-owned report adapter

`ServerActivityPlugin.reports` declares `activityTypeKeys` and optional `logs` and `studentActions` handlers. The host supplies a `GradebookActionContext`: authorized actor, course/activity and roster. A read-only `logs` handler receives `before` and `limit`, returns neutral `ActivityLogEvidence`, and must constrain every query to the supplied roster/activity. Return stable namespaced IDs, UTC timestamps, shared event types, optional attempt number, actor ID and teacher reason. Never return private plugin payloads. Activities without an adapter still receive core logs.

Student actions are separate from read-only gradebook downloads. `studentActions.list` returns localized labels/confirmation/reason prompts and eligible `{id,participantId,groupId,targetId}` actions. The target is an opaque, specific submission identity. The host refuses out-of-roster actions and renders them only in the relevant student's menu.

`GET …/student-actions` discovers current actions. Its `recoverAutomatic` adapter flag preserves Homework's existing authorized teacher-read cutoff recovery, now without a visible management panel. Recovery stays scoped to the authorized sections; issues use notifications. Logs never run this recovery. Compatibility `manage-submissions` APIs remain available.

`POST …/student-actions` requires action/target/enrollment/section IDs and a nonblank reason of at most 2,000 characters. Core authorizes again, reloads eligibility with recovery disabled and rejects changed targets with `ACTIVITY_ACTION_CHANGED`. The plugin executes its existing cancellation/reset service, which retains its own locking, team checks, audit and grade withdrawal. A stale menu cannot target a newer submission. Team cancellation confirms its effect on every current member; individual reset retains the shared files. File-only work offers cancellation and omits challenge reset. Successful actions refresh progress, grades and eligibility. Mutations have a blocking progress dialog; confirmations can be cancelled before execution.

No migration or environment change is required. Local regression coverage is in `activity-logs.spec.ts`, core scope/action/cursor tests, and the existing Homework workflow, progress and download scenarios.
