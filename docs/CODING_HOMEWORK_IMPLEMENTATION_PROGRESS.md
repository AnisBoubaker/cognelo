# Coding Homework implementation progress

This is the resumable work record requested by the user. It complements the [product specification](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) and must be updated at each validated implementation slice.

## Objective and authorization

Implement the agreed Coding Homework workflow for local testing: C, 30 individual students, persistent file/ZIP preparation, static solution-derived requirements, manual submission opening after reference preparation, immutable work, queued question generation, explicit SEB/timed answering, read-only source consultation, and teacher cancellation/resubmission. Do not deploy or test production.

The user explicitly authorized reasonable remaining assumptions and requested them in the final report. Commit validated slices along the way rather than one huge final commit. Do not stop after a partial implementation merely because a slice is complete.

## Confirmed follow-up choices — November 1, 2026

- Match C function name, argument count/types and return type; ignore parameter names and equivalent pointer/array notation.
- Missing files, missing functions and signature mismatches require explicit incomplete-work acknowledgement rather than blocking solely for incompleteness. Safety/authorization limits remain hard failures.
- Individual uploads support destination folders and confirmed replacement at the same path. ZIP replaces the entire prepared collection.
- OpenAI `text-embedding-3-small` for embeddings; question-generation model changes do not invalidate indexes.
- Question-generation concurrency defaults to 2, with a server-enforced maximum of 4.
- Lock material selection while submissions are enabled.
- At the answering deadline submit saved answers, including blanks.
- Teacher cancellation retains the old record, withdraws its associated grade, and permits a new submission with newly generated questions.
- Material plugins own generation/refresh of their indexes as a service. All inter-plugin requests are routed through core; never import a sibling material plugin from homework.

## Checklist

- [x] Record authorization, clarifications and recovery checklist.
- [ ] Static C signature validation and private teacher-solution/function selection (signature core committed; private solution API implemented).
- [ ] Persistent upload collection, ZIP replacement, validation acknowledgements and frozen hand-in.
- [ ] Core-dispatched material-plugin indexing services, OpenAI embeddings, immutable reusable indexes and freshness.
- [ ] Source selection/readiness/manual enablement; public GitHub, PDF, text and linked slides extraction.
- [ ] Durable bounded FIFO processing, restart/retry/cancellation protection and correct question counts.
- [ ] Deferred SEB/timed answering through shared contracts; deadline finalization and teacher cancellation.
- [ ] Complete teacher/student UI and localized states; read-only submitted files and accessible course materials.
- [ ] Unit, type, architecture and local Playwright integration checks, including bounded concurrent processing.
- [ ] Documentation review, operator notes and final runnable local handoff.

## Assumptions to report

- Static C validation uses bounded declaration normalization, without compilation/preprocessing. Typedefs retain their spelling; common builtin spelling, parameter names, storage qualifiers and array-to-pointer adjustment are normalized. Syntax failures can be acknowledged as incomplete work, while analysis/storage/ZIP safety limits remain blocking.

## Current checkpoint

- Baseline: documentation commit `d67e1ea`; working tree was clean before this task.
- Static validation slice implemented: signature-bearing parser results and requirements, signature mismatch reports, and an acknowledgement/readiness classifier. Legacy strict preflight remains intact until the new preparation workflow uses the classifier.
- A task-owned macOS `caffeinate -i -s` assertion is active during implementation. The local PID is in `.git/info/cognelo-homework-caffeinate.pid`; stop only that process when the job finishes.
- Resume by reading this file and the current Git diff; do not redo completed work.

- Preparation/private solution foundation validated by local Playwright: persistence, replacement confirmation, ZIP replacement, path rejection, signature acknowledgement, no attempt/timer before answering, and staff-only solution access. API/web/plugin typechecks passed. New final hand-in/UI remains in progress.

## Validation and commits

- `93ec082`: recorded implementation checklist and the user’s follow-up clarifications.
- `235c5ce`: static signature requirements/readiness classifier; 19 focused tests and plugin typecheck passed.

## Important implementation pointers

- New plugin files: `src/c-signatures.ts`, `file-preparation.ts`, `teacher-solution.ts`, `preparation-routes.ts`.
- Deferred gates: `ActivityDefinition.assessmentFlow`, `PluginRouteDefinition.learnerAccessPhase`, assigned API dispatcher and host SEB/timing callbacks. Homework currently opts in; finish the new student renderer before handoff.
- New plugin Prisma models: `PluginCodingHomeworkDraft` and `PluginCodingHomeworkTeacherSolution`; submission status adds `cancelled`. Generated homework Prisma artifacts are now removed from Git tracking (the existing ignore rule applies). Generate them locally with the normal database commands; schemas/migrations remain tracked.
- Material index generation/refresh MUST remain a material-plugin service dispatched by core. Shared storage/provider helpers may be used through core; no homework-to-material-plugin import.

## Active integration checkpoint

- `e62b9a9` committed persistent preparation, private teacher solution and deferred assessment foundations; preparation Playwright passed.
- Material service implementation now includes private shared OpenAI vectors/indexes, plugin-owned text/file/link/GitHub extraction, public DNS-pinned fetching and per-repository freshness settings. Core migration applied locally.
- Final hand-in, queue limits/heartbeats/recovery, atomic full question publication, deferred answering, deadline jobs, teacher cancellation and initial UI are implemented but integration validation is in progress. Do not report completion yet.
- Assume bounded exact cosine search over real embeddings in PostgreSQL Float32 storage for the initial class size; no pgvector/server-image replacement. Text PDFs only (Poppler), no OCR. Empty reference selection is explicitly preparable; questions then use the assignment/submitted work.
- New key files: `workflow-settings.ts`, `hand-in.ts`, `prepared-processing.ts`, `deadline.ts`, `submission-management.ts`, `workflow-routes.ts`, and `src/web/homework-*.tsx`.
- Pending: local full workflow/SEB/cancellation/deadline/concurrency Playwright tests; update old unit mocks/route lists; full locales; correctness/privacy/documentation review and remaining commits.

- `b1fe883`: committed plugin-owned semantic material services; 94 focused material tests passed.
- Full workflow Playwright passed: reusable indexes/model independence, immutable files, configured five questions from one function, explicit answering, timeout blanks, activity-details cancellation and fresh resubmission.
- SEB and 30-student Playwright passed: verified return/no repeated launch, provider-failure retry, concurrency 2/4 with server cap, FIFO starts, stale lease recovery, cancelled running/queued jobs publish no questions.
- Live extraction verification succeeded for the supplied public slide deck and a small public C repository; no AI calls or persisted material indexes were made by those read-only checks.
