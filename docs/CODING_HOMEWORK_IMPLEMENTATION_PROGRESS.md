# Coding Homework implementation checkpoint

**Status: implemented and locally validated on November 1, 2026.** No production deployment or production testing was performed. This is the resumable record requested by the user; the [approved workflow](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) and [plugin reference](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md) are the canonical behavior documents.

## Delivered

- [x] Private C teacher solution; manual/AI function selection; normalized argument/return signatures; explicit incomplete-work acknowledgement.
- [x] Persistent file/folder preparation, confirmed replacements, whole-collection ZIP replacement, read-only preview and frozen final hand-in.
- [x] Plugin-owned material indexing dispatched through core; actual PDF, text, linked-slide and public GitHub extraction; reusable configured embeddings and immutable snapshots.
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

## Model-choice follow-up — November 2, 2026

Connections now reuse one encrypted credential across purpose-tagged model catalogues. Homework Reference materials selects the embedding model; Settings selects question generation. Question-model edits preserve indexes and frozen jobs. OpenAI-compatible/Codex and Ollama embeddings are supported; generation supports all existing providers. See the [AI selection checkpoint](AI_MODEL_SELECTION_IMPLEMENTATION_PROGRESS.md) for validation and assumptions.

## ZIP references and preparation errors

The File material plugin now reads bounded source/text ZIP entries with path/header/size/checksum checks, ignoring executable/generated/macOS content. Binary-only archives produce an actionable failure. Homework preparation identifies the active/failing material, records errors in shared notification history as well as inline state, and retains successful indexes for retry. Cancelled operations do not create error notifications.

Validation: 1,809 unit tests, workspace typechecks, lint on changed code, production build, and three focused material/editor E2E scenarios passed. The actual local course archives also passed extraction and generation through the configured provider; environment-specific evidence remains private. Root/plugin documentation was reviewed; the file and homework README/memory/canonical references are current. No migration or new environment variable is required.

## Challenge context and generation policy

Each challenge now shows the student's submitted function/code context read-only with filename, function name and line numbers. An allowlisted 24,000-character excerpt matches the model evidence bound; full files stay available. Existing questions can use retained function/file records without regeneration. Private reference code, teacher instructions, ASTs and storage identities remain excluded from learner DTOs.

Settings now exposes **AI question-generation instructions** through the activity draft/save boundary; bank authoring keeps the field in Activity. The prepared and legacy generators place this policy in the system prompt. New hand-ins freeze the course Subject's teaching language and private instructions; request/session locale never selects the question language. Existing question wording remains unchanged. Prompt versions distinguish the new policy (`prepared-homework-v3`, legacy challenge v2); no migration is required.

Validation: 1,817 unit tests and six focused E2E scenarios passed, covering French generation with an English UI and conflicting request locale, saved instructions, queued-language stability, existing-record context, privacy, read-only/mobile rendering, autosave/reload, incomplete work, SEB and 30-student concurrency. The Settings save-progress visibility check also passed. All workspace typechecks and the production build passed. The local worker was restarted to load generation-handler changes. Owning README/memory/reference and the approved workflow were reviewed and updated; no documentation verification gap remains.

## Submitted-work tabs and preparation simplification — November 3

Submitted work now reuses the shared left navigation used by Settings/course folders. The first file opens automatically, content aligns with the first tab, and filenames/sizes are not repeated above it. Selection survives polling; late reads are ignored, errors can be retried, empty files are explicit, and mobile retains a contained two-column view. Individual-file preparation now uploads to the root without folder controls; ZIP replacement preserves nested paths. Native FileList entries are copied before asynchronous confirmation so input clearing cannot discard the chosen upload.

Validation: 1,817 unit tests, typechecking, build and six targeted E2E scenarios passed across the viewer, preparation, challenge context and shared navigation. Desktop/mobile screenshots were reviewed. Root/plugin navigation and workflow documentation were reviewed and updated. The remaining student-flow refinements are completed below.


## Completed student preparation and submission flow — November 3

The shared left-tab explorer now covers preparation and submitted work. Draft tabs have confirmed delete crosses, and Remove all files atomically clears files/folders after confirmation; submitted work has neither deletion control. Same-path replacements reload the visible content, deleted selections fall back to the first remaining file, and late reads cannot overwrite the current selection. Filenames/sizes are not repeated above the aligned content pane. Individual uploads use the root; ZIP folders remain intact.

Students get only the two available resource downloads: assignment PDF and one provided-files ZIP. Checking is explicit through Check my submission, with a structural-only explanation, validity indicator or complete missing-requirement list. Submit appears after a valid current check or explicit incomplete-work acknowledgement, still respecting the teacher gate. Confirmed file changes reset the check. Hand-in warns that submitted work cannot be changed and revalidates the actual files server-side.

Validation completed: 1,822 unit tests, 13 distinct targeted local E2E scenarios across the combined changes, all workspace typechecks, lint on changed components/services, and the production build passed. Browser coverage includes shared settings/course-folder navigation, both file-viewer states, late reads, replacement/deletion confirmation, atomic bulk clearing with stale/frozen guards, ZIP folder retention, PDF/ZIP downloads, structural checks, incomplete submission, challenge context and the complete submission workflow. Desktop/mobile screenshots were inspected. Only synthetic local fixtures/provider stand-ins were used; private data and generated artifacts remain outside Git. Root/plugin README, memory, architecture and canonical workflow references were reviewed and updated; no documentation verification gap or migration remains.

## Focused, fair challenge questions — November 3

The shared generation policy now targets understanding of the submitted implementation through one focused point answerable in 2–3 sentences. Questions should be reasonable for the student who wrote the code at the course level, using small concrete cases, conditions/guards or other local choices without forcing one template. Avoid long traces, obscure rules, missing context and assertions that buggy or undefined behavior is correct. Legacy generation now supplies earlier questions as the prepared path already did. Prompt versions advance to prepared v4 and legacy v3; existing question wording and student answer limits are unchanged.

Validation: all 1,824 unit tests, all workspace typechecks and the focused queue/context E2E passed. The E2E uses a controlled provider boundary and verifies that the new policy reaches generation while course-language and private-instruction rules remain intact. A nullable legacy MIME-type typing issue in provided downloads was also corrected and covered. The local worker was restarted with no pending/running jobs to load the policy. Owning README/memory/reference and approved workflow were reviewed and updated; no migration or documentation verification gap remains.

## Unchanged provided-code exclusion — November 3

Both generators now exclude unchanged teacher-provided C functions before selecting candidates. Individual C/H attachments and C/H sources within provided ZIPs participate; the private solution and course references do not. Token hashes ignore comments/whitespace while retaining literal values and all implementation tokens, so changed functions remain eligible. Hand-in stores only a compact hash/name manifest, never another copy of provided files. Versioned parsing is cached and the manifest survives later attachment edits. Existing question sets are retained.

If no eligible function remains, the worker fails once with a clear localized teacher-review message, without generating questions about starter code or calling the provider. The incomplete-source fallback remains available only when neither side has parsed functions and the source differs from provided files. Prompt/output checks reject explicit excluded-function targets and retain eligible code context during correction retries. Prepared/legacy prompt versions are v5/v4; no schema migration is needed.

Validation: 1,832 unit tests, architecture checks, all workspace typechecks, focused lint, production builds and seven local E2E scenarios passed. The new E2E covers ZIP/direct sources, moved/formatting-only functions, filtering before candidate limits, private-solution separation, changed literal eligibility, retained hash manifests after attachment edits, rejected model targets, and the no-eligible-code state without provider calls. Regressions cover downloads, incomplete submissions, course language/code context, SEB, the 30-student queue and the complete hand-in/deadline/cancellation workflow. Provider boundaries use synthetic local fixtures; private course evidence remains untracked. The local worker was restarted with no pending/running jobs. Root/plugin navigation, memory, architecture and canonical references were reviewed; no documentation verification gap remains.

## Clearer student challenge cards — November 3

Current and legacy answering now share numbered question cards. Each prompt comes first in a tinted header; the framed code context and labelled answer area sit side by side on wide cards and stack on narrow ones. Long code scrolls inside a bounded keyboard-focusable panel, filenames/functions wrap, and visible spacing separates the next question. Existing question content, saved answers, autosave and deadline/completion guards are preserved. All four interface locales include the new labels.

Validation: plugin typecheck and two local Playwright scenarios passed, covering multiline code, question order/separation, responsive layout, contained horizontal scrolling, accessible answer labels, autosave/reload, course-language/privacy boundaries and submission/timeout/cancellation. Desktop/mobile screenshots were inspected. Focused lint has no errors; the existing legacy effect-dependency warning is unchanged. The original single-line text assertion was adapted to compare source lines without rendered line numbers. Owning README/memory/reference and approved workflow were updated; root navigation/architecture remain current. No migration or documentation verification gap remains.

## Answer finalization and notifications — November 3

Manual finalization now accepts partial or entirely blank answer sets. Both answering views use a shared confirmation that warns answers cannot be changed and lists unanswered question numbers in display order; whitespace-only answers count as missing for this warning. Cancel/close preserves editing and does not finalize. Automatic deadline submission remains independent of confirmation and closes it on timeout/completion. The server still finalizes all question timestamps atomically, preserves omitted saved answers, rejects changes after completion and uses only saved answers after expiry. Student workspace errors now appear through shared notifications/history without a page-top duplicate.

Validation: 1,834 unit tests, architecture checks, all workspace typechecks and two local E2E scenarios passed. Coverage includes empty/partial/whitespace answers, exact missing-question lists, cancellation, fully answered confirmation, notification-only failure/retry, retained answers, completed-state locking, an open confirmation at the deadline, and offline saved/blank deadline submission. The confirmation screenshot was inspected. Focused lint has no errors; the existing legacy effect-dependency warning remains. Owning README/memory, canonical workflow/reference and historical all-answers statements were reviewed and updated; root navigation/architecture remain current. No migration or documentation verification gap remains.

## Student generation queue status — November 3

The student waiting panel now shows an inline spinner and its server-reported queue position, refreshed through the existing workspace polling. Once processing starts, it switches to the generation message without a queue number. The suggestion to leave/return is removed in all four locales; background persistence is unchanged. Reduced-motion preferences suppress spinning, and failure/readiness removes the spinner.

Validation: plugin typecheck, focused lint, SEB acceptance and the extended 30-student queue E2E passed. Browser checks cover queued position, active processing, readiness, mobile overflow and reduced motion; the mobile screenshot was inspected. The FIFO assertion now checks that the oldest two jobs are admitted together, allowing their concurrent provider requests to arrive in either order. The final load test passed after restarting the local worker with no queued/running work. Owning README/memory/reference and approved workflow were reviewed and updated; root navigation/architecture remain current. No migration or documentation verification gap remains.
