# Programming Homework editor and optional questions

Status: implemented and locally validated, November 9, 2026.

## Approved layout

The core top tabs are Activity, Concepts and Reference materials. Reference materials stays core-owned for embedding/RAG-capable course activities. Activity contains the shared left navigation:

- Activity: title, description, programming language, assignment text in the shared WYSIWYG editor, assignment PDF with a collapsed preview, and provided files. Remove the separate rendered assignment preview and student-submission management from authoring; management remains in Class overview.
- Teacher solution: private solution and required filename/function/signature selection. Filenames appear on the left with required checkboxes and delete actions; selecting one shows only its signatures on the right. Select the first file initially and preserve selections across files.
- Submission requirements: immediately after Teacher solution; manual required files/folders/functions, ignored paths, allowed extensions and requirements import.
- Question Generation: an On/Off switch, then question count, candidate limit, retrieved examples, generation model, private instructions, team question policy and generation concurrency. Hide or disable dependent controls when off, retaining their saved values.
- Submission settings: submission opening and upload file-count/size limits, plus a link to core Activity scheduling. Stage deadlines, optional durations and file late policy are edited beside availability in the shared assignment-settings dialog.
- Simulation: teacher ZIP preflight, its structural warnings and explicit simulated hand-in confirmation, then questions generated from that uploaded ZIP. Never fall back to the private solution.

Use shared SideNavigation, RichTextEditor, EditActionBar, notifications and cancellable progress. Keep drafts mounted across navigation and Save/Cancel available in edit sections. Use On/Off switches for boolean settings; keep checkboxes for selecting files/functions/materials. This preference applies to activity editing generally.

Teacher explanations use shared contextual help immediately after the associated heading or label on the same line, including solution selection, simulation, question policy and the scheduling link. Routine date displays silently use the configured timezone. Preserve student instructions, structural-check results, submission warnings and confirmations. See [contextual help](CONTEXTUAL_HELP.md).

## Approved workflow choices

- Existing and new homework defaults to question generation enabled. Lock its switch while active final hand-ins exist. Preserve prior records and hidden question settings.
- With questions disabled, hand-in freezes files and immediately records completed, ungraded work for teacher review. No AI connection, embeddings, question-generation job, answering timer or SEB answering session is required. Normal assignment access, file validation, acknowledgement, deadlines and immutable hand-in remain enforced. Individual and team hand-ins, late joiners, automatic cutoff recovery and teacher cancellation must remain coherent.
- Simulation uses only an uploaded preflight ZIP. Academic gaps may proceed after the teacher explicitly acknowledges incomplete work and chooses to simulate submission, matching the student decision flow. Unsafe/unreadable archives remain blocking. Keep simulation artifacts private and temporary; no learner attempt or grade is created.
- Reference materials remain a top-level core panel even when generation is off; preparation is required only when the workflow actually generates questions. Existing prepared references are retained.
- Course-only operational settings and RAG simulation remain course-scoped. Bank authoring retains reusable assignment/solution/question configuration; course references and submission opening are configured after placement.

## Implementation checkpoints

- [x] Optional-question policy and immediate individual/team completion through core gradebook services.
- [x] Preflight-owned simulation with validation, explicit acknowledgement, cancellation and private output.
- [x] Shared left-tab authoring, WYSIWYG assignment, collapsed PDF and common toggle control.
- [x] Focused unit/E2E regressions, documentation review and incremental commits.

No production deployment or testing is part of this task. Preserve all stable plugin/API/storage identifiers and keep private archives, credentials and generated clients out of Git.

## Completion boundary

The authored `settings.questionGenerationEnabled` boolean defaults to true when missing. Omitted values in older clients preserve the saved setting. A mode change is rejected while active final hand-ins exist. Otherwise saving a mode change closes final submissions until the teacher explicitly reopens them, preventing newly enabled questions from bypassing reference/model preparation. Hidden generation settings and prepared references are retained.

Hand-in freezes its effective question policy. File-only hand-in publishes immutable files and a completed, ungraded core attempt in one transaction, with question count zero and no generation/deadline job. Team members receive independent completed attempts over shared frozen bytes; late joiners do the same. Core revokes old membership attempts before the plugin creates new participation, so a newly completed late-join attempt is not withdrawn accidentally. Cancellation withdraws the associated grade and permits replacement; challenge reset is unavailable for file-only work. Automatic cutoff recovery uses its frozen submission time and normal incomplete-work acknowledgement rules.

Core exposes `recordDeferredActivitySubmission` and a transaction-bound SDK `recordDeferredSubmission` callback. Only trusted server code that already authorized and froze the evidence may call it. It checks the deferred activity/provider, active enrolled learner, attempt limits and grade-release policy, preserves ordinary core lifecycle/knowledge snapshots, and can record existing frozen work after its availability end without opening an answering session. Ordinary `startActivityAttempt` date checks are unchanged. No public endpoint accepts this completion mode.

Backend validation: 172 targeted unit tests and core/plugin typechecks passed. Five distinct local E2Es passed: file-only individual hand-in/retry/SEB/incomplete acknowledgement/cancellation/automatic recovery; file-only team late join, leave/rejoin, grade withdrawal and cancellation; normal individual challenges; both common and individual team question modes. Tests use disposable local courses and controlled model fixtures.

## ZIP simulation and editor details

Teacher preflight uploads retain a private temporary artifact with a 24-hour expiry, original filename and normalized requirements fingerprint. Simulation requires that teacher's course preflight ID, verifies its stored identity/size/hash and current requirements, and reruns static checks. Missing requirements require explicit acknowledgement; blocking file rules remain blocking. A changed requirements set requires another Check ZIP. The teacher can cancel the confirmation or generation. Reference query embeddings accept the same cancellation signal. Previous completed results survive cancellation, while a new ZIP/activity clears them.

One main Save/Cancel bar and navigation guard covers basic fields, teacher requirements, question settings, generation-model selection, concurrency and submission opening. Deadlines, stage durations and late policy are now owned by the core assignment-settings dialog. There are no nested model/deadline bars or immediate operational autosaves. Cancel restores all these fields together. Focus/material refreshes preserve pending edits. Save submits only edited plugin workflow fields alongside assignment/requirements in one private transaction. The shared assignment-settings dialog separately saves stage scheduling and its overrides. Failed enablement rolls back the private changes. The host core title/config request remains its existing separate lifecycle operation. Core Reference materials retains its independent save boundary, as do explicit file uploads/private solution catalog changes. Changing question mode drafts submissions as closed; opening from a previously locked reference snapshot requires saving the close first so freshness is rechecked. Tabs remain mounted; preflight requests abort on activity change. RichTextEditor uses the public `config.assignmentMarkdown` mirror for core media retention/copy/version support. Teacher solution and instructions remain private. The PDF uses a native collapsed disclosure. File-only Review and grade opens Submitted files directly.

Existing saved identifiers, model choices and upload paths remain unchanged. The earlier editor reorganization added no schema migration. Shared stage scheduling now requires the additive private preparation-clock migration documented in [the stage contract](ACTIVITY_SUBMISSION_STAGES.md); no environment variable changes. The previously committed display-name migration still applies during the ordinary upgrade path.

## Validation and handoff

- Full unit suite: **338 files / 1,948 tests passed**. All workspace typechecks, plugin boundaries and API/web production builds passed. Focused lint has no errors; three pre-existing warnings remain in the shared editor/legacy answering renderer.
- **27 distinct local E2E scenarios passed** across the final and regression runs. Coverage includes bank/course authoring, PDF bytes/collapsed preview, shared WYSIWYG and image retention/student access before SEB, top/left tabs and draft retention, reference Save/Cancel and lock refresh, core model reuse/freshness/privacy, duplication, ordinary and incomplete hand-in, per-section team policy and both question-sharing modes, deadlines/lateness, file-only completion/SEB bypass/idempotency/automatic cutoff, late joins and leave/rejoin with grade withdrawal, cancellation, private ZIP simulation and other AI provider consumers.
- Simulation proves that questions target the uploaded ZIP rather than a different private solution, follow course French despite English UI, exclude unchanged provided helpers, keep private retrieved content hidden, and stop/discard cancelled generation. Security unit checks cover foreign/missing/expired preflights, stale requirements, changed bytes, unsafe stored paths, acknowledgement and blocking file rules. No learner attempt or grade is created by simulation.
- Draft checks include saving a mode change while a generation-model choice is unsaved: the single Save retains both, and file-only simulation proceeds without model resolution. Same-activity saves keep panels mounted. Returning to References refreshes submission locks without discarding selection drafts. Failed initial authoring loads offer Refresh and cannot expose an empty saveable form.
- Desktop/mobile Activity, Question Generation and Simulation screenshots were inspected. UI tests use isolated local courses and controlled AI endpoints, so these results validate integration/policy delivery rather than real-provider question quality. No production tests or deployment were performed.

Implementation choices: changing question mode closes final submissions until explicitly reopened; upload limits live in Submission settings; Simulation/operational course settings remain course-scoped; checked ZIPs use the existing 24-hour temporary preflight lifetime. Existing/new activities default to questions enabled. The user explicitly chose switches for editor settings while item selection and incomplete-work acknowledgement remain checkboxes.

Root and plugin README/memory/architecture/index, the authoring handbook, media/material reference contracts and the approved homework workflow were reviewed and updated. Material extraction ownership remains unchanged. No documentation verification gap remains. Backend completion is committed as `940e392`; the subsequent editor/ZIP-simulation commit completes this delivery.

## Follow-up acceptance: one draft and separated requirements

The former model/deadline save bars and concurrency/opening autosaves are superseded by the single-draft contract above. Manual rules have their own Submission requirements section; Submission is now Submission settings. Teacher solution filters signatures by the selected file without losing other selections.

This follow-up passed 184 homework/shared-UI unit tests, all workspace typechecks, boundaries and 20 distinct local E2E scenarios. Coverage includes Save/Cancel across every left section, no premature writes, reload, invalid-duration retention, failed-enable rollback, bank/course master-detail selection and deletion, model providers, references, duplication, simulation, individual/team deadlines, incomplete hand-in and full bank-to-student completion. Desktop/mobile screenshots were inspected. Focused lint has no errors and one existing legacy effect warning. No migration, environment change or production work. The backend slice is `bfcc69f`; the following UI commit completes this follow-up.

Stage scheduling now follows [the shared core contract](ACTIVITY_SUBMISSION_STAGES.md). The first file upload starts an optional preparation duration; no academic attempt is created. Answer starts its own optional duration after generation. Shared Settings shows each plugin-named stage’s effective calendar deadline and independently overridable date/time-limit/late fields. Question generation off disables its stage while retaining its configuration.
