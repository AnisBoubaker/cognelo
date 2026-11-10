# Programming Homework implementation checkpoint

The current display name is **Programming Homework**; legacy `coding-homework-grader` identifiers remain stable. See the [naming compatibility contract](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md#display-name-and-compatibility).
**Status: implemented and locally validated on November 1, 2026.** No production deployment or production testing was performed. This is the resumable record requested by the user; the [approved workflow](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) and [plugin reference](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md) are the canonical behavior documents.

Current staged delivery uses the [core activation and scheduling contract](ACTIVITY_SUBMISSION_STAGES.md): preparation before activation, independent file/question gates, inherited section/student policies and retained answering starts. The plugin reference owns the detailed waiting/queue behavior.

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
- [x] Same-course duplication retains authoring/model/reference configuration and independently owned prepared snapshots without copying student or assignment state. See the November 4 checkpoint below.

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

## Isolated AI test providers — November 3

AI test providers now belong to disposable accounts with private connections, bound only to their synthetic course. Shared teacher/admin preferences are never redirected or restored from stale metadata snapshots. The common helper, standalone workflow, account model selector and rubric tests all use the isolated owner/session. Hand-in model pinning and the real question-generation policy are unchanged. Diagnose captured mock connections independently from question/function/file ownership; private environment evidence stays outside Git.

Validation: 28 distinct local E2E scenarios passed, including a new two-course/two-provider isolation check, private-connection denial for shared logins, unchanged shared preferences, owner cleanup, model catalogues, OpenAI/Claude rubric calls, Codex/Ollama generation/embeddings, 30-student queue, SEB, workflow, authoring, material reuse, code exclusion, question context and student submission controls. The audit also migrated the older administrator connection CRUD and staff-fallback preference scenarios; all seven staff-authorization checks, the broad homework authoring/continuation case and atomic-finalization security case passed. Typechecking common-fixture consumers and focused lint passed. Root/plugin README, project memory and canonical test/reference documentation were reviewed and updated; programming-exercise runtime documentation remains current. No runtime migration or documentation verification gap remains.

## Legitimate helper references and corrective generation — November 3

The output guard no longer rejects a question merely for mentioning a provided helper. A question first anchored in the student's eligible function may ask about its call, guard or result handling; directly targeting unchanged provided code remains rejected. Modified submitted function names are removed from the excluded-target list, including when another function is currently being questioned. Deterministic candidate filtering remains unchanged.

Prepared generation now sends the rejection reason and bounded previous response on each correction retry while retaining the code/reference context, language and prior questions. It distinguishes invalid JSON/schema, duplicates and provided targets. Three invalid outputs fail once with a private question number/reason instead of blindly retrying the whole set; network/provider failures keep normal retries. Publication remains atomic. Prompt versions are prepared v6 and legacy v5.

Validation: 1,838 unit tests, all workspace typechecks, focused lint and two targeted local E2E scenarios passed. Coverage includes valid helper references, forbidden provided targets, modified functions, corrective prompt context, terminal output failure after exactly three provider calls, course-language/code-context privacy and unchanged answer gates. The real configured provider was probed locally without publishing questions to reproduce the overly strict check. A guarded local recovery then retried an unchanged failed submission only after verifying that it had no published questions or answering attempt; it completed on its first job attempt with a full French question set. Recovery backup/evidence remains private outside Git. Owning README/memory/reference and approved workflow were reviewed and updated. No migration or documentation verification gap remains.

## Wide teacher review and submitted-file inspection — November 3

Review and grade now fills the shared wide workspace (up to 1840 px), keeping messages/dismissal aligned with the panel. Questions and answers open first in shared numbered cards with Markdown, submitted code and explicit unanswered labels. A separate Submitted files tab uses the shared read-only left-tab viewer, replacing the long filename/size table. Grade and feedback sit beside the content on wide screens; file-tab changes preserve drafts, and unsaved changes trigger the existing host guards. Unsupported regrading controls are omitted. Historical/formative review remains read-only.

The new staff-only `gradebook-file` route reads one exact retained file on demand after group grading authorization and participant/submission/core-attempt ownership checks. It reuses frozen-file path/size/hash validation and the existing text preview bound. Learners, foreign participants/submissions and unknown paths are denied. No source is eagerly added to review lists, and review never regenerates questions.

Validation: 1,838 unit tests, workspace typechecks, focused lint and three local E2E scenarios passed. Checks cover wide toolbar/panel alignment, one dialog, mobile containment, first-file selection/content, nested paths, file authorization, question/blank-answer rendering, unsaved-grade cancellation and persisted grading. Student file viewing and challenge context/autosave regressions also passed. Desktop/mobile screenshots were inspected. Root/plugin navigation, memory and canonical review/dialog references were reviewed and updated; no migration or documentation verification gap remains.

## Same-course duplication — November 4

The plugin's course-duplication hook now preserves explicit question/embedding model choices and the effective source material selection. It clones the active prepared snapshot while sharing its immutable core index IDs; cached embeddings are not regenerated. Default materials are resolved at the source placement, including unsaved homework. Existing attachment/private-solution/requirement copying stays independent. Submission opening, core assignment/delivery settings, student work and grades are excluded; bank transfers retain their existing context-reset policy.

Validation: 96 focused unit tests across 26 files, API/plugin typechecks, focused lint and plugin-boundary checks passed. Both local Playwright duplication scenarios passed, including real source hand-in/answers/grading, browser duplication, exact PDF bytes, copied private solution/requirements/models, no duplicated academic records, independent snapshots surviving source deletion, opening without new model calls, and default-selection preservation. The initial E2E run exposed a fixture cleanup-order error; cleanup now deletes fixture-owned copies before deleting its temporary teacher. The plugin README/memory/reference, approved workflow, test documentation and root duplication contract were reviewed; no migration or core implementation change was needed.


## Pedagogical reference verification — November 4

Link extraction now rejects recognizable title/navigation/loading/login/JavaScript shells and unreadable required slide sources before embedding storage. Its versioned policy invalidates old link readiness at the next preparation, while already enabled/submitted snapshots remain immutable. Static hidden lesson panels are retained; arbitrary script-only websites remain unsupported. These concrete failure checks do not claim semantic completeness.

Reference materials now provides a private, read-only Preview indexed text action. Core returns authorized, bounded saved passages; the homework plugin selects its exact pinned index version, or the latest saved index outside a prepared selection. The localized inline viewer supports pagination, keyboard focus, cancellation of stale reads, retry and literal source rendering. It makes no model calls and exposes no vectors/metadata. Closed-homework readiness requires current ready indexes to match the snapshot; old prepared flags cannot keep submission opening enabled after a source becomes stale.

Validation: 202 focused unit tests, four local E2E scenarios (preview, duplication and embedding reuse/freshness), core/API/owning-plugin typechecks, focused lint and architecture checks passed. The real public lecture deck still yielded complete bounded slide text including its final chapter in a read-only extraction probe; no provider call or persisted index was needed for that probe. E2E verified exact old pinned text after another homework refreshed the material, passage pagination/focus/mobile containment, source escaping, student/index-identity denial, and no extra AI/academic work. Root and affected plugin navigation/memory/canonical references were reviewed and updated. No schema migration or production operation was performed.

## Team hand-in — November 5

The [team workflow](TEAM_ACTIVITY_SUBMISSIONS.md) supersedes the initial individual-only scope. Core provides opt-in team delivery, per-section grouping/unteamed policies, current-membership resolution and transactional revocation. The homework plugin adds shared revisioned preparation, actor-attributed file events, one frozen file collection, common or independently generated questions, private individual answering/timers/grades, late joins, whole-team cancellation and per-student challenge reset. Empty-team contents are erased with recoverable physical cleanup. Individual and team hand-ins expose frozen ZIP downloads and structural rechecks. No student-history conversion is required.

Local migration `202611050010_team_workspaces` is additive. Apply through `npm run db:migrate:all`; no new environment variables. Generated clients remain untracked. A running development server must restart after Prisma enum/client generation. Core commits `d8122ef` and `719df62` establish the assignment/lifecycle boundary; subsequent plugin and UI commits complete it.

Validation: both common-question and separate-question team lifecycle E2Es pass against real local APIs/storage/queue, using a disposable model boundary. The 12-test regression run covers these plus individual hand-in, timed completion, blank-answer confirmation, file explorers, the 30-student bounded queue, SEB proof/return, and student team-choice behavior. Workspace-wide typechecking and plugin architecture checks pass. No production tests or deployment were performed.

Implementation choices: team mode defaults off; common questions default on. When a section disallows individual hand-in, unteamed students can read/download assignment resources but cannot upload, check, or submit work until joining a team. This explicit user clarification supersedes the initial private-draft assumption. Pending accounts acquire individual answering on activation/access. Common-mode reset reuses the shared questions; separate-mode reset generates anew. File/participant audit records retain action metadata, not another source-code copy. The additional two-section settings/unteamed E2E passed; the final count is 13 distinct E2E scenarios and 250 focused unit tests. Settings/learner screenshots were visually inspected, Prisma schema validated, and the affected documentation reviewed. ESLint reports no errors; one pre-existing legacy answering-hook dependency warning remains. The team plan records final handoff.

## Team membership required before preparation — November 5

User clarification removes private preparation for unteamed students when the section disallows individual submission. Such learners see the statement/provided downloads and a localized notice; upload/check/hand-in controls are absent. Server workspace access rejects preparation/file/hand-in requests before creating a draft or member binding. Joining/leaving updates the open page through existing polling, and stale uploads remain blocked. Individual submission remains available in sections that explicitly allow it.

Validation: four local E2E scenarios passed, including actual PDF/ZIP downloads while blocked, rejected direct uploads/reads/deletion/hand-in, no private workspace creation, join/leave UI transitions, both team question modes and ordinary file preparation. All 94 homework unit tests passed, plus plugin/web type checks, targeted lint and architecture checks. Screenshot inspected; no schema migration or production changes.

## Submission deadline and elapsed lateness — November 5

Homework Settings now owns an optional course-timezone deadline plus late permission and an optional days/hours/minutes limit. Core activity availability and manual submission enablement remain independent. Individual and team hand-in enforce the server-side cutoff, recheck after validation, preserve successful retries and snapshot the accepted timestamp/deadline/exact delay. Students, operational staff and Review and grade display the immutable elapsed lateness. Existing submissions are not retroactively classified and challenge-answer timing remains separate. No migration or environment variable is needed.

Validation: 106 homework unit tests passed, including cutoff boundaries, invalid policies, explicit-zone conversion and exact lateness snapshots. Six local E2E scenarios passed: individual/team deadline settings and enforcement, Toronto entry from a Tokyo browser, bounded/unlimited late acceptance, student/staff/review delay display, policy changes and retries, mobile layout, ordinary workflow/timeout, team-required access and duplication. Desktop/mobile screenshots inspected; plugin/web type checks, targeted lint and architecture checks passed. Tests use the existing isolated model fixture. Backend policy is committed in `e8e704b`; the subsequent UI commit completes the feature. Root and plugin orientation documents and relevant workflow/reference sections were reviewed and updated where needed. No production changes.

## Automatic hand-in at finite cutoffs — November 5

Saved nonempty work is now recovered at the ordinary deadline when late work is disallowed, or at the end of a bounded grace period. No-deadline/unlimited-late work remains manual. The learner workspace checks its own due work; Class overview explicitly requests authorized class recovery. Enabled submissions/prepared references remain required, while staff may recover saved work after learner activity closure. Editor list reads do not trigger class recovery.

Recovery uses the ordinary individual/team hand-in transaction and queue, acknowledges academic gaps with explicit automatic provenance, and records cutoff-based timing plus actual recovery time. Empty, unsafe/unreadable or post-cutoff-modified drafts are not silently accepted; one failed copy does not stop the class. Draft edits stop at the cutoff. Repeated/concurrent reads are idempotent, and teacher cancellation after the cutoff is respected. Verification shows a prominent not-submitted reminder beside Submit, with separate automatic-cutoff guidance and automatic/incomplete receipts.

Validation: nine local E2E scenarios passed, covering learner and class triggers, team recovery after activity closure, incomplete work, repeated reads, cancellation, unlimited-late/manual verification, empty drafts, old deadline rules, shared/separate team workflows, prepared tabs and ordinary answering/timeout. All 116 homework unit tests passed, including failed-copy isolation, scoped authorization and cutoff guards. Plugin/web type checks, targeted lint and architecture checks passed; the verification notice screenshot was inspected. No migration, environment change or production operation. Backend recovery is committed in `ceb54de`; the following UI/test commit completes the feature. Affected root/plugin orientation and canonical workflow/reference documents were reviewed and updated.

## Explicit hidden reference selection — November 6

Reference materials now offers the full course tree with effective hidden/inherited-hidden labels. Only visible materials before the actual activity anchor are selected by default; explicit folder selection includes hidden descendants, and saved choices survive reload. Preparing the selection pins the hidden index subset and current preparing manager. Generation searches that subset privately through core with current manager authorization, while visible/legacy references retain learner scope. Direct learner material access and question projections remain unchanged. Same-course copies retain the index subset and establish the copying manager's authority.

Validation: five local E2E scenarios passed (new hidden selection/indexing/generation/privacy test, saved-text preview, both duplication cases and ordinary homework workflow). All 122 homework unit tests passed, including private-subset/manager/revocation checks. Plugin/web type checks, targeted lint and architecture checks passed; the picker screenshot was inspected. The development API was restarted because its registered worker retained the older generation function after hot reload. Affected homework README/memory/workflow/reference and shared material-service documentation were reviewed and updated; the material plugin itself needed no changes. No migration, environment change or production operation.

## Shared reference authoring — November 6, 2026

The core capability/adapter, shared Reference materials panel and independent course embedding setting supersede the earlier per-homework embedding picker and preparation-in-Settings layout. The new panel owns Save/Cancel, search/folders/readiness/previews and cancellation. Existing private snapshots/copy semantics remain intact; new preparation uses the course model. See [implementation and validation checkpoints](ACTIVITY_MATERIAL_REFERENCES.md). One additive core settings migration is required, with no new environment variables.

The Simulation tab shares real prepared question generation, saved instructions/course language/references and provided-code exclusion. Local acceptance verified cancelled output is discarded, the next request succeeds, private retrieval text stays off the UI, student routes are denied, no attempts/submissions are created, and a later real hand-in uses the same generator. Results are intentionally transient and course-authoring-only.

Validation for the shared-reference/Simulation delivery: 337 unit files / 1,942 tests, all workspace typechecks, architecture checks, API/web production builds and 21 targeted local E2E scenarios passed. Desktop/mobile reference and Simulation layouts were inspected. Tests use isolated local AI fixtures; no production actions. Core reference/course-model slice: `324c43e`; the following Simulation commit completes the feature. Detailed assumptions and coverage are in the linked shared-reference document.

## Programming Homework editor and optional questions — November 9, 2026

The [editor contract](PROGRAMMING_HOMEWORK_EDITOR.md) supersedes the old Settings/Simulation top tabs and teacher-solution simulation. Core top tabs remain Activity/Concepts/References; shared left sections own basic fields, solution/requirements, optional question generation, submissions and checked-ZIP simulation. File-only hand-ins complete immediately for individual/team grading without AI/embeddings or answering. Existing question behavior is the default and mode changes lock with active hand-ins.

Validation: 338 unit files / 1,948 tests, all workspace types, boundaries, API/web builds and 27 distinct local E2Es passed; desktop/mobile layouts inspected. The core/individual/team completion slice is `940e392`; the following editor/simulation commit completes the feature. Tests use local disposable courses and isolated AI fixtures; no production actions or new schema/environment requirements.

## Unified editor saves and requirements navigation — November 9, 2026

Activity now has six shared left sections: Activity, Teacher solution, Submission requirements, Question Generation, Submission settings and Simulation. Teacher solution shows a filename picker beside that file’s function signatures, with first-file selection, keyboard navigation, compact required checkboxes, persistent selections across files and selected-file deletion fallback. Manual requirements/import moved into Submission requirements, directly after Teacher solution.

One main Save/Cancel and navigation guard covers assignment/requirements plus model, concurrency, opening and deadline drafts. There are no nested save bars or immediate switch/concurrency writes. Cancel restores all fields, incidental refreshes retain edits and invalid durations fail before writing. Changed workflow fields join assignment/requirements in one private transaction with existing authorization/readiness/locks; core title/config retains its existing lifecycle request. Explicit uploads/catalog changes and core References remain independently persisted. The API slice is committed as `bfcc69f`.

Validation: 20 distinct local E2E scenarios passed, covering combined Save/Cancel/no premature writes/reload, invalid-duration retention and private rollback; both bank/course file pickers, deletion and cross-file selections; model providers, duplication, references, PDF bytes, rich text, incomplete submissions, individual/team deadlines, ZIP simulation and full authored-homework completion. All 184 homework/shared-UI unit tests, all workspace typechecks and plugin boundary checks passed. Focused lint has no errors and one pre-existing legacy answering effect warning. Desktop/mobile file-picker and editor screenshots were inspected. No schema migration, environment change or production operation; private fixtures and generated outputs remain untracked. Root/plugin orientation and canonical references were reviewed and updated; no documentation verification gap remains.

## Core submission-stage scheduling — November 9, 2026

Completed the [shared stage contract](ACTIVITY_SUBMISSION_STAGES.md): plugins declare all ordered/localized stage names; core owns optional stage/overall dates, durations, late policy and field-level General/section/team/student inheritance. The earlier date wins and overall Until remains a hard cap. Homework deadlines moved from authoring into shared Activity settings beside availability; legacy defaults and endpoint compatibility are preserved. Preparation clocks start at first accepted upload, answering at explicit Answer, and queue wait consumes no answering time. Inactive question settings remain saved. Stage schedules follow course assignment reset rules on duplication.

Validation: 2,043 unit tests / 341 files, all workspace types and boundaries, and 27 distinct local API/E2E scenarios passed. Scheduling/date/duration/late matrices, actual answering/finalization, file clocks/recovery, legacy migration defaults, overrides/nulls, disabled stages, authorization and malformed-input rollback are covered alongside ordinary/Test expiry, content access, existing homework and editor regressions. Desktop/mobile screenshots inspected; focused lint has no errors and one existing legacy effect warning. Additive plugin migration `202611090020_submission_stage_clocks` was applied locally; no environment changes or production operations. Backend commit `ddb6452`; shared UI/acceptance follows. Canonical documents reviewed and synchronized.
