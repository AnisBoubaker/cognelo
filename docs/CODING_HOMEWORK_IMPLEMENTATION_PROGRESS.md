# Coding Homework implementation checkpoint

**Status: implemented and locally validated on November 1, 2026.** No production deployment or production testing was performed. This is the resumable record requested by the user; the [approved workflow](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) and [plugin reference](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md) are the canonical behavior documents.

## Delivered

- [x] Private C teacher solution; manual/AI function selection; normalized argument/return signatures; explicit incomplete-work acknowledgement.
- [x] Persistent file/folder preparation, confirmed replacements, whole-collection ZIP replacement, read-only preview and frozen final hand-in.
- [x] Plugin-owned material indexing dispatched through core; actual PDF, text, linked-slide and public GitHub extraction; reusable OpenAI embeddings and immutable snapshots.
- [x] Default preceding-material selection, recursive folder toggles, readiness invalidation, GitHub freshness settings and manual submission opening.
- [x] Atomic enqueueing, FIFO admission, teacher concurrency 1–4/default 2, queue-wide cap 4, heartbeats/retries/stale-worker recovery and cancellation protection.
- [x] Explicit SEB-verified answering start, core timing/attempts, saved-answer autosave, offline deadline finalization including blanks and continued read-only source access.
- [x] Teacher cancellation from activity details/editor, retained evidence, associated grade withdrawal and one replacement after release without changing class-wide release.
- [x] English/French/Chinese/Arabic states, course and bank private-solution authoring, migrated existing homework acceptance tests and updated documentation.
- [x] Local migration, full typecheck/unit/architecture/build validation, eight focused E2E scenarios and public extraction checks.

## Validation evidence

- Full workspace typecheck passed.
- `npm test`: **316 test files / 1769 tests passed**, with plugin architecture checks.
- `npm run build`: API and web production builds passed.
- Focused lint: no errors; the retained legacy renderer has its pre-existing hook-dependency warning.
- **Eight local Playwright scenarios passed**: six new acceptance scenarios plus updated bank-authoring/continuation and atomic-submission security regressions. Seven passed in the final combined run; the bank test then passed after fixing its wait for an enabled upload input. No product failure is left marked expected/skipped.
- New files: `homework-preparation.spec.ts`, `homework-workflow.spec.ts`, `homework-queue-seb.spec.ts` (two scenarios), `homework-materials.spec.ts`, `homework-incomplete.spec.ts`.
- The 30-student run validated 2/4 concurrency, the hard cap, FIFO starts, interrupted-worker recovery, and suppression of late output after running/queued cancellation. Remaining 28 students received all three questions each.
- Material checks covered compressed PDF extraction, exact index reuse across homework, question-model independence, GitHub 48-hour default/per-material override, enablement-time freshness and selection invalidation. Read-only live extraction succeeded on the supplied lecture deck and a small public C repository.
- Complete workflow checks covered five questions from one function, no attempt before Answer, offline saved/blank deadline submission, released-grade withdrawal and successful replacement. Private-solution UI checks covered manual/AI selection, reload persistence, incomplete-code fallback and mobile read-only viewing.
- AI acceptance used controlled local OpenAI-compatible endpoints; it exercised real browser UI, API routes, persistence, encryption, queues and grading policy without paid model calls. Native SEB startup was simulated; real proof/configuration scoping and session reuse were tested. Native-client acceptance remains for the user.

## Commits

- `93ec082` — initial decisions and recovery checklist.
- `235c5ce` — static C signature validation and acknowledgement classifier.
- `e62b9a9` — persistent preparation/private solutions and deferred-assessment foundations.
- `b1fe883` — plugin-owned reusable material embedding services.
- `35b126e` — remove previously tracked generated Prisma artifacts containing machine paths/native binaries.
- `142f57c` — durable concurrency, worker-slot replenishment and interruption recovery.
- `5a7a117` — complete hand-in, queued challenges, timed/SEB answering, cancellation and user interfaces.
- `720f7e9` — adapted acceptance fixtures and final documentation review.
- Final hardening strips replacement-authorization keys from ordinary attempt metadata. The 44 core gradebook tests, core typecheck and released-grade cancellation/replacement E2E passed after this change.

## Implementation assumptions

These were authorized as reasonable choices and must be reported at handoff:

- Bounded static C normalization, without preprocessing/compilation; typedef spelling remains significant. Missing academic requirements and syntax incompleteness require acknowledgement; resource/archive/storage failures block.
- Question count 1–20/default 3; cycle candidate functions for distinct questions, or use submitted source/assignment text when none parse. Three automatic generation attempts; terminal failure requires teacher cancellation/resubmission.
- Visible shared course materials only in the chooser. Folder selection includes current recursive descendants. An empty selection can be explicitly prepared. Private teacher solutions are never automatically indexed.
- Public GitHub default branches pinned to a commit, static linked content/Reveal.js Markdown, and text-based PDFs. No private repos, arbitrary JavaScript execution, branch/path chooser or OCR.
- Float32 vectors in PostgreSQL with bounded exact cosine search; no pgvector extension or database-image replacement. Existing configurable upload limits remain, with 8 MB individual files and the archive-size ceiling applied to the prepared collection.

See [full choices and limits](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md#recorded-implementation-assumptions-and-deferred-work) and [material services](MATERIAL_EMBEDDING_SERVICES.md).

## Local handoff and privacy

Both additive migrations were applied locally with `npm run db:migrate:all`; Poppler is available. The API worker must remain enabled for queue/deadline processing. To test: upload the teacher solution, choose requirements and save; select references and Generate embeddings; enable final submissions; then use an enrolled student's preparation and answering flow.

Credentials, private course/student data, local logs, generated clients, screenshots and deployment inventory are excluded from Git. The existing ignore rule now applies to the untracked homework-generated Prisma client; regenerate through normal database commands. All affected root/plugin READMEs, project memories and canonical references were reviewed and updated.

The task-owned macOS caffeinate assertion was kept active during implementation and validation. It is stopped at final handoff, and the ordinary local API/web development services are left available for the user's test. No synthetic test material or fake AI connection is intentionally retained in the visible application.

## Authoring recovery follow-up — November 2, 2026

Private solution controls now use compact checkbox rows with per-file/per-function removal and Clear solution. ZIP replacement is explicit, retains relative paths, filters macOS metadata and rejects binary/invalid source before JSON storage. Definition-free headers are accepted. Owner locks/revisions protect replacement; linked requirements and the editor baseline are reconciled without losing unrelated edits. A failed upload leaves the prior solution intact. Function exclusion does not modify the source file and persists until that file is replaced.

Assignment PDF/file transport now preserves native Response bytes/headers/status through bank, course and learner dispatch; the labelled preview and View PDF no longer receive `{}`. Learner content closure still cancels blocked streams. Local acceptance covers both authoring contexts, macOS archives, replacement/removal/reload, draft preservation, binary rollback, compact desktop/mobile choices, PDF preview/new-tab requests and student authorization. All 1,774 unit tests and full typechecks passed; four local E2E scenarios passed, and the mobile screenshot was inspected. Test inputs and screenshots remain synthetic/ignored.

The follow-up also separates course authoring into Reference materials (selection/readiness) and Settings (concurrency, Generate embeddings, final-submission switch). The shared checkbox/radio base now excludes text-field sizing. Eight local E2E scenarios passed across authoring/PDF recovery, tab draft retention, concurrency-selection preservation, cancellation from Settings, complete homework submission and existing Programming Exercise editor tabs. Reference/Settings mobile screenshots and the native PDF preview were inspected. The file-response fix is committed as `8cbd0d2`; the remaining authoring changes are recorded in the subsequent commit.

Final follow-up verification also passed full workspace typecheck and API/web production builds. Focused lint has no errors (two pre-existing unused-local warnings remain in the shared editor-tabs component). No database migration or production operation was needed. Runtime and test fixtures remain local; generated build declarations were restored instead of committed.
