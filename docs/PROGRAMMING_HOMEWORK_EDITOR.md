# Programming Homework editor and optional questions

Status: implementation in progress, November 9, 2026.

## Approved layout

The core top tabs are Activity, Concepts and Reference materials. Reference materials stays core-owned for embedding/RAG-capable course activities. Activity contains the shared left navigation:

- Activity: title, description, programming language, assignment text in the shared WYSIWYG editor, assignment PDF with a collapsed preview, and provided files. Remove the separate rendered assignment preview and student-submission management from authoring; management remains in Class overview.
- Teacher solution: private solution and required filename/function/signature selection, manual required files/folders/functions, ignored paths and allowed extensions.
- Question Generation: an On/Off switch, then question count, candidate limit, retrieved examples, generation model, private instructions, team question policy and generation concurrency. Hide or disable dependent controls when off, retaining their saved values.
- Submission: submission opening, deadline/late policy, and upload file-count/size limits.
- Simulation: teacher ZIP preflight, its structural warnings and explicit simulated hand-in confirmation, then questions generated from that uploaded ZIP. Never fall back to the private solution.

Use shared SideNavigation, RichTextEditor, EditActionBar, notifications and cancellable progress. Keep drafts mounted across navigation and Save/Cancel available in edit sections. Use On/Off switches for boolean settings; keep checkboxes for selecting files/functions/materials. This preference applies to activity editing generally.

## Approved workflow choices

- Existing and new homework defaults to question generation enabled. Lock its switch while active final hand-ins exist. Preserve prior records and hidden question settings.
- With questions disabled, hand-in freezes files and immediately records completed, ungraded work for teacher review. No AI connection, embeddings, question-generation job, answering timer or SEB answering session is required. Normal assignment access, file validation, acknowledgement, deadlines and immutable hand-in remain enforced. Individual and team hand-ins, late joiners, automatic cutoff recovery and teacher cancellation must remain coherent.
- Simulation uses only an uploaded preflight ZIP. Academic gaps may proceed after the teacher explicitly acknowledges incomplete work and chooses to simulate submission, matching the student decision flow. Unsafe/unreadable archives remain blocking. Keep simulation artifacts private and temporary; no learner attempt or grade is created.
- Reference materials remain a top-level core panel even when generation is off; preparation is required only when the workflow actually generates questions. Existing prepared references are retained.
- Course-only operational settings and RAG simulation remain course-scoped. Bank authoring retains reusable assignment/solution/question configuration; course references and submission opening are configured after placement.

## Implementation checkpoints

- [x] Optional-question policy and immediate individual/team completion through core gradebook services.
- [ ] Preflight-owned simulation with validation, explicit acknowledgement, cancellation and private output.
- [ ] Shared left-tab authoring, WYSIWYG assignment, collapsed PDF and common toggle control.
- [ ] Focused unit/E2E regressions, documentation review and incremental commits.

No production deployment or testing is part of this task. Preserve all stable plugin/API/storage identifiers and keep private archives, credentials and generated clients out of Git.

## Completion boundary

The authored `settings.questionGenerationEnabled` boolean defaults to true when missing. Omitted values in older clients preserve the saved setting. A mode change is rejected while active final hand-ins exist. Otherwise saving a mode change closes final submissions until the teacher explicitly reopens them, preventing newly enabled questions from bypassing reference/model preparation. Hidden generation settings and prepared references are retained.

Hand-in freezes its effective question policy. File-only hand-in publishes immutable files and a completed, ungraded core attempt in one transaction, with question count zero and no generation/deadline job. Team members receive independent completed attempts over shared frozen bytes; late joiners do the same. Core revokes old membership attempts before the plugin creates new participation, so a newly completed late-join attempt is not withdrawn accidentally. Cancellation withdraws the associated grade and permits replacement; challenge reset is unavailable for file-only work. Automatic cutoff recovery uses its frozen submission time and normal incomplete-work acknowledgement rules.

Core exposes `recordDeferredActivitySubmission` and a transaction-bound SDK `recordDeferredSubmission` callback. Only trusted server code that already authorized and froze the evidence may call it. It checks the deferred activity/provider, active enrolled learner, attempt limits and grade-release policy, preserves ordinary core lifecycle/knowledge snapshots, and can record existing frozen work after its availability end without opening an answering session. Ordinary `startActivityAttempt` date checks are unchanged. No public endpoint accepts this completion mode.

Backend validation: 172 targeted unit tests and core/plugin typechecks passed. Five distinct local E2Es passed: file-only individual hand-in/retry/SEB/incomplete acknowledgement/cancellation/automatic recovery; file-only team late join, leave/rejoin, grade withdrawal and cancellation; normal individual challenges; both common and individual team question modes. Tests use disposable local courses and controlled model fixtures.
