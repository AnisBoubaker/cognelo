# Coding Homework Grader detailed reference

The [approved workflow](../../../../docs/CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) records product choices; the [progress record](../../../../docs/CODING_HOMEWORK_IMPLEMENTATION_PROGRESS.md) records local validation and commits. Version-2 preparation is the current student workflow. Legacy ZIP/analysis helpers remain for historical records and tests, but the old final-ZIP POST rejects new submissions.

## Current state

Teachers author the assignment, private C solution, selected function signatures and required paths. Students upload individual files at the root or a replacement ZIP with its folder structure preserved. The UI offers no destination-folder selector or folder-creation action; the preparation API retains path/folder compatibility. Students manage the persisted revisioned file collection, validate and acknowledge academic gaps, and explicitly hand it in after teacher enablement. No browser code editing, execution tests or automatic correctness grading are introduced.

The course editor has separate **Reference materials** and **Settings** tabs. Reference materials contains the embedding connection/model selector, material selection and per-material readiness; Settings contains the independent question-generation connection/model selector, private AI question-generation instructions with the activity Save/Cancel action bar, Students processed at once, Generate embeddings, and Enable/Disable final submissions. Enabled own/global connections come from core with purpose-tagged model catalogues. Save model choice persists it; Manage connections opens account configuration, and Refresh models reloads the catalogue while retaining other drafts. Student submission management remains in the Activity tab and activity details report. Host portals keep a single workflow mounted so tab changes and ordinary assignment saves retain unsaved selections. Changing concurrency refreshes server readiness without replacing the selection draft. Progress/cancellation renders outside hidden panels, with the current material title during preparation. Workflow action/refresh failures use the shared notification center as well as inline errors. Preparation failures name the material and annotate its reference row; retries reuse successful indexes. Cancellation does not create an error message. The bank editor retains Activity/Concepts because its references are course-scoped.

The manual submission switch is backed by a prepared reference snapshot. Course-visible materials preceding the homework are selected by default; recursive folder toggles select their current descendants. Selection changes clear readiness, and material-source/freshness checks run before enablement. Empty selection can be explicitly prepared. See [material services](../../../../docs/MATERIAL_EMBEDDING_SERVICES.md) for extraction, compatibility and resource limits.

Hand-in freezes files and enqueues work atomically. FIFO dispatch has teacher parallelism 1–4 (default 2) and a server-wide homework ceiling of 4. The configured question count is 1–20 (default 3); eligible candidates cycle when fewer functions exist, with distinct questions required. Unchanged provided functions are excluded before candidate limits. Incomplete-source fallback is allowed only when neither submitted nor provided functions can be parsed, and excludes source identical to provided files. Jobs retry up to three times; cancelled/stale workers cannot publish. Students see persistent status, without a generation Cancel action.

The explicit Answer action creates the core attempt only after required SEB verification. Existing attempts preserve their start. Saves/finalization resolve current section/team/student policy. Timeout uses saved answers including blanks. The shared timed-finalization hook and a durable deadline job handle page departure; jobs recheck changed deadlines before finalizing. Normal course materials remain accessible. Prepared and submitted files use the platform’s shared left navigation as vertical tabs with the selected file’s read-only, syntax-highlighted content on the right. The first file opens automatically; polling preserves the current selection, while a new submission resets it. The content aligns with the first tab, without a duplicate filename/size heading. Up/Down/Home/End keys switch files. Loading clears the previous content; aborted or late responses cannot replace the current file. Errors offer Retry and enter notification history. Empty files show an explicit message. Both panes remain side by side on mobile, with long paths wrapping and code scrolling inside its pane. Before hand-in, each tab has a separately focusable delete cross with confirmation; same-path replacements reload the content using the draft revision. Deleting the selected file selects the first remaining file. Remove all files clears the entire draft after confirmation. Both forms of deletion invalidate structural-check results only after confirmation. After hand-in, delete controls are absent and server writes remain frozen. Activity availability and optional content-closure policy still apply.

Teacher cancellation is available in the activity details report and editor, including submissions with no core attempt yet. It atomically preserves the old record, withdraws its associated selected/override grade, records the reason, cancels work and grants a replacement attempt where applicable. It does not change whole-class grade release. New work receives new questions; no student cancellation exists.

## Routes and persistence

All routes are under `coding-homework-grader/` and retain the host's course/group/bank authorization.

| Route | Purpose |
| --- | --- |
| `preparation` GET/POST/DELETE | Metadata/validation, file/ZIP/folder upload and file removal or `{ all: true, expectedRevision }` bulk removal with revision checks. |
| `prepared-file` GET | Read-only preview of a prepared file. |
| `teacher-solution` GET/PUT/DELETE; `select-functions` POST | Private solution upload/replacement/removal and known-function AI selection. |
| `workflow-settings` GET/PUT | Reference tree, readiness, bounded concurrency and manual opening. |
| `prepare-material` POST; `prepare-references` POST | Core-dispatched plugin indexing and immutable snapshot completion. |
| `workspace` GET; `hand-in` POST | Safe persistent state and atomic freezing/enqueueing. |
| `answering` GET/POST | SEB-guarded question retrieval/explicit attempt start. |
| `submitted-file` GET | Read-only frozen source. |
| `provided-files-download` GET | One owner-authorized ZIP of provided attachments, available during preparation. |
| `activity-file` GET | Authorized individual attachment; PDFs are inline unless `download=1`. |
| `challenge-answers` PUT/POST | Serialized autosave and final submission, including server-saved expiry. |
| `manage-submissions` GET/DELETE | Scoped staff list/cancellation, including queued work. |

`PluginCodingHomeworkDraft` owns revisions/file hashes/folders. `PluginCodingHomeworkTeacherSolution` owns private files/parsed signatures. Existing submission/file/question tables hold frozen work and derived output; status adds `cancelled`. Assignment settings hold protected workflow keys and the prepared snapshot ID; ordinary authoring saves cannot overwrite these keys. Snapshots retain immutable core material-index IDs. `workflowVersion: 2` distinguishes new records from legacy analysis artifacts.

Generated clients are local artifacts. Apply the additive manifest migration `202611010010_homework_preparation` and core material-index migration using `npm run db:migrate:all`. Material PDF extraction needs Poppler; no new environment variable is required. The API's ordinary background worker must remain enabled. Storage uses the existing private homework filesystem root and SHA-256 integrity checks.

## Shared contracts

Core resolves assignment exceptions, current answering deadlines, attempt limits, grades and content closure. Student view stays inspection-only. Private solutions are not the shared released-student-solution feature. UI labels cover English, French, Chinese and Arabic; timestamps use the effective course timezone. Teacher assignment edits use the guarded action bar; independently persisted uploads/reference actions do not pretend to be part of its draft.

## Seed Fixture

The root Prisma seed creates `Coding homework grader: INF-155 TP1 Labyrinthe` as a complete dev fixture in Programming 101 / Section A. It reads `tmp/INF155-A2023-TP1.pdf` with `pdftotext`, attaches a copied PDF to the activity when the local file exists, uses `tmp/FichiersFournis` to build starter-file documentation, and stores bank/course plugin authoring rows, required ZIP structure/functions, a ready group documentation snapshot, a summative group assignment, and a gradebook item. Challenge question generation uses a course teacher/owner's configured question-authoring AI connection (or explicit homework model override); the seed does not point teacher question authoring at the local Ollama fallback.

## Legacy pipeline implementation (historical records)

The phased implementation plan lives in:

- `docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md`

Phase 0 captured stable service contracts for the future implementation in `src/algorithm.ts`. Phase 1 renamed the package, plugin key, activity key, and localized picker metadata to Coding Homework Grader.

Phase 2 added the plugin-owned Prisma schema, generated client, and activation migration manifest. The plugin tables are registered through `src/db.ts` so the existing plugin activation/deactivation flow can create, back up, and restore them.

Phase 3 added teacher authoring routes and UI. Teachers can edit assignment Markdown, upload an assignment PDF, edit/import structure requirements, preview the assignment text, and save bank-owned or course-owned plugin records. Assigning a bank activity to a course copies the bank assignment, requirement set, and safe attachment records into course-owned plugin rows so later bank edits and course edits diverge.

Duplicating a bank-owned Coding Homework Grader activity copies its assignment, requirement set, and attachment records through the platform bank-duplication hook. Attachment rows are independent while continuing to reference the same stored immutable files. Moving retains the activity ID and all plugin-owned authoring rows.

Phase 4 added prior-documentation preview and snapshot routes. Course activity authoring can show visible content resources that appear before the activity in the content tree and can write a `PluginCodingHomeworkDocumentationSnapshot` row with anchor metadata, included resource metadata, and a stable content-tree fingerprint. Activity bank authoring does not show this preview because banks have no course content tree.

Phase 5 added extraction from snapshot resources through the shared content type plugin server interface. The Coding Homework Grader calls core's generic content extraction dispatcher and stores extracted documents plus diagnostics in `PluginCodingHomeworkDocumentationSnapshot.metadata.extraction`; text/file/PDF/GitHub-specific extraction logic stays in the owning content type plugins.

Phase 6 added `src/parsers.ts` with the language-neutral parser registry and first C parser adapter. It extracts C function definitions, emits deterministic normalized AST text, records source lines and code, and returns recoverable diagnostics for broken or unsupported files.

Phase 7 added `src/zip.ts`, `src/validation.ts`, and `src/preflight.ts`. Students and teachers can upload a temporary ZIP for structure validation against teacher requirements; the service separates missing required items, unsupported files, parser diagnostics, ignored files, valid files, and valid functions. Preflight creates plugin-owned `PluginCodingHomeworkSubmission` rows with `kind = preflight` and temporary attachment metadata, but it does not create a core attempt, gradebook record, challenge questions, or a final submission.

Phase 8 should not create a Coding Homework Grader-only vector database. Content resources belong to content type plugins, so content plugins should own extraction/chunking and invalidation decisions behind the shared content type plugin server interface, while production vector persistence/search should move to shared platform pgvector tables. The Coding Homework Grader should request similarity over prior course content through core/content-plugin dispatchers and store only the audit metadata it needs for selected references, nearest examples, generated questions, and submissions.

Phase 8 added `src/reference-search.ts` and the `coding-homework-grader/reference-search` route. Reference search reads a documentation snapshot's included content resources, calls core's generic vector search dispatcher, and stores the latest search audit metadata on the snapshot. The plugin does not read or own prior-content vector tables.

Phase 9 added `src/submission.ts`, the `coding-homework-grader/assignment` route, and the `coding-homework-grader/submission` route. Assigned students can load the prompt, submit a final ZIP, receive structure validation feedback, and create durable final submission/file records. Valid submissions store a non-temporary ZIP attachment plus extracted file rows; invalid structure submissions are recorded but do not extract files or write the uploaded ZIP. Gradebook attempts and challenge questions remain later phases.

Phase 10 added `src/analysis.ts` and the `coding-homework-grader/submission-analysis` route. Valid final submissions now analyze extracted source files, parse submitted functions, store deterministic development embeddings, retrieve nearest prior examples through core/content-plugin vector search, compute divergence scores, and mark selected candidates for future challenge generation. Prior course-content vector search stays behind the shared content type plugin interface; submitted functions are plugin-owned assessment artifacts.

Phase 11 added `src/generation.ts` and the teacher-only `coding-homework-grader/challenge-generation` route. Teachers can trigger or retry challenge question generation for analyzed submissions using their server-side question-authoring AI agent connection. Generated questions are stored in `PluginCodingHomeworkChallengeQuestion` with prompt version, model, selected function provenance, nearest examples, prompt hash/text, raw response, and attempt count. Phase 12 added the student-facing question/answer UI; prior examples and generation provenance remain server-side and must not be exposed to students.

Phase 12 added automatic student-path challenge generation and `src/challenge-answers.ts`. Valid student ZIP submissions now analyze the submitted functions, generate the challenge set through a course teacher/owner's configured question-authoring AI connection (or explicit homework model override), and return a student-safe question payload immediately. The `coding-homework-grader/challenge-answers` route saves draft answers with `PUT` and finalizes answers with `POST`, moving the plugin submission to `ready_for_grading`. The current finalization policy permits unanswered questions, superseding the original all-answers requirement.

Phase 13 added gradebook integration and teacher manual grading. Valid final upload reserves a core `ActivityAttempt` linked to the plugin submission and tagged with the assignment's formative/summative mode; final answers submit that same attempt. Teachers can open the activity gradebook detail page and inspect submitted file metadata, generated questions, student answers, and selected function source for either mode. The teacher route accepts an optional exact final-submission ID while constraining it by activity, group, participant-linked user, and matching non-deleted core attempt; the shared dialog therefore loads the newest current-mode submission first and fetches older payloads only during navigation. Formative and historical attempts are read-only; the newest summative attempt can save score/feedback through the normal core gradebook override workflow. Once released, that teacher-entered grade/feedback is challengeable through the core course workflow when the effective summative assignment setting permits it; review reopens the same manual-grading panel.

Phase 14 added operational hardening on top of the shared core background job service. Student final ZIP submissions include an `idempotencyKey` so browser/network retries reuse the existing submission instead of creating duplicates, then enqueue `coding-homework-grader.process-submission` for analysis and challenge generation. Upload/extraction, analysis, and challenge generation append processing timeline entries to submission metadata; failed processing stores categorized retryable/non-retryable error details; and teachers can use `coding-homework-grader/reprocess` to retry unfinished/failed submissions without duplicating derived function/question rows. The student view polls latest submission state until questions are ready and keeps the shared blocking progress dialog visible across both the initial request and that polling interval. Student preflight uses the same indeterminate dialog.

Assignment PDFs and teacher-provided files are activity-owned attachments, not course content resources. Teachers can view the PDF inline and add, open, or remove provided files from the authoring screen; students can open the same assigned files. Bank-to-course copying preserves these attachment records. Documentation extraction adds the assignment Markdown, extractable PDF text, and provided text/source files to the snapshot alongside prior visible course resources. C functions from provided files are parsed into function-level reference documents, and submission analysis merges their similarity matches with course-content matches before selecting challenge candidates.

Current plugin-owned tables:

- `PluginCodingHomeworkAssignment`
- `PluginBankCodingHomeworkAssignment`
- `PluginCodingHomeworkSubmissionRequirementSet`
- `PluginBankCodingHomeworkSubmissionRequirementSet`
- `PluginCodingHomeworkAttachment`
- `PluginCodingHomeworkDocumentationSnapshot`
- `PluginCodingHomeworkReferenceFunction`
- `PluginCodingHomeworkSubmission`
- `PluginCodingHomeworkSubmissionFile`
- `PluginCodingHomeworkSubmissionFunction`
- `PluginCodingHomeworkChallengeQuestion`
- `PluginCodingHomeworkReview`

The prototype in `tmp/challenge-questions/scripts` is a research reference only. Production code must not import from `tmp`, execute the Python scripts, or depend on those files being present.

Prototype-to-platform mapping:

- `0_data_cleanup.py` -> source normalization
- `1_parse_code.py` -> parser adapters and AST serialization
- `2_generate_corpus_embeddings.py` -> reference indexing
- `3_compute_similarities.py` -> similarity search
- `4_select_candidates.py` -> candidate selection
- `5_generate_questions.py` -> RAG-backed challenge question generation

The first parser implementation will target C, matching the research paper and prototype. The contracts are language-neutral so later adapters can support additional languages.

Prompt versioning starts with:

- `coding-homework-grader.challenge-question.v1`

Teacher authoring uses the shared responsive `EditActionBar`. Its saved/unsaved status covers the activity and plugin-owned grading configuration, while independently persisted uploads and processing actions retain their local feedback.

The activity definition uses the semantic `file-code` icon rendered by the platform's shared Tabler icon layer.

Explicit course/bank synchronization replaces assignment, requirement, and authoring-attachment rows through plugin hooks in either direction. Retrieval is blocked after any attempt. Publishing retains shared immutable stored files while replacing bank-owned records; core creates the immutable version and continues to allow publication after attempts because attempted course content is unchanged.

Bank-version comparison currently covers generic activity config and metadata only. Private assignments, requirements, and attachments are excluded because they are not snapshotted by activity version.

Draft saves update mutable generic/private bank authoring without creating a version. Changed Published saves create immutable generic snapshots; private authoring remains unversioned.

## Contributor Workflow

When changing this plugin, update this detailed reference or the phased implementation plan, the package README if its overview or routing changed, and `PROJECT_MEMORY.md` only when a durable invariant changed.

## Reopening the last submission

Reopens the existing challenge answers while retaining the uploaded ZIP and generated questions. Prior mutable completion evidence is audited; final answers submit through the same core attempt without regenerating questions. The shared [continuation service](../../../../docs/SUBMISSION_CONTINUATION.md) enforces latest-attempt and staff scope, archives prior evidence, preserves attempt identity and original start, and applies current General/section/team/student settings. Later extensions or individual exceptions therefore affect the resumed deadline without resetting it.

### Timestamp display

Submission, review, and other dated UI records use the shared effective course timezone: the administrator’s application default unless a course owner has selected an allowed override. Stored instants remain UTC; plugin UI must not infer a timezone from the learner device. See [Application time](../../../../docs/APPLICATION_TIME.md) for the shared context and clock/security contract.

## Restricted student review

The optional [core content-closure policy](../../../../docs/ACTIVITY_CONTENT_ACCESS.md) governs learner retrieval after permitted attempts end, including compound Test children. Shared dispatch denies closed content/history/file reads and returns only a closure signal after the final submission; teacher inspection and stored evidence remain intact. Released grades do not authorize detailed reports or solutions while closed.

## Shared action controls

Teacher, learner, and settings actions follow the platform [button and icon contract](../../../../docs/ACTION_BUTTONS.md). Use explicit semantic `ActionIcon` names with localized labels; dimensions and interaction colors are shared CSS, while tabs, disclosure rows, and specialized editor controls retain their own layout.

## Answer exports

The plugin implements `submissionExport.getContent` for the [shared PDF/ZIP export](../../../../docs/ANSWER_EXPORTS.md). Exports read retained submitted text/source files and challenge answers, with optional assignment Markdown/PDF, question text, and teacher comments. Assignment-PDF pages accompany their own attempt and are omitted when prompts are disabled. Binary files remain identified attachments; no analysis or question generation is run. The host enforces teacher/section scope, submission lifecycle, exact attempt selection, and prompt/grading switches. Private provider requests, credentials, and provenance are never exported.

## Learner data boundaries

The definition’s `studentConfig` returns only grading mode, attempt-display settings, and repository template URL; generic authoring metadata and nested bank/version records are excluded from learner transport.

## Upload and finalization boundaries

Preflight remains non-academic and expires after 24 hours. Current preparation creates no core attempt. Final hand-in revalidates the actual draft, copies immutable files and queues generation in one transaction. A workflow lock and draft revision make repeated hand-ins idempotent and prohibit parallel unfinished work. Failed transactions remove staged files. Legacy analysis/reprocess routes reject current version-2 records.

Answer saves/finalization lock the submission and its core attempt. Finalization updates every answer and submits the explicitly started core attempt atomically. Identical finalization retries return the retained result, while changes after completion or timeout are rejected. Legacy unfinished records without a core attempt reserve it during finalization. The deadline dispatcher replaces expired finalization input with saved answers and blocks new uploads.

Manual finalization accepts partial or entirely blank answer sets. Omitted answers retain their saved value or become empty strings when never answered; every question receives its submission timestamp. Current and legacy student views use `HomeworkAnswerConfirmation` over the shared confirmation dialog before a manual POST. It always warns that submitted answers cannot be changed and lists “Question N” for each empty/whitespace-only answer, in displayed order. A fully answered set omits the list. Cancel/close sends no finalization request and preserves edits/autosave. Completion or timeout hides the confirmation; automatic expiry continues without waiting. Student workspace request/load failures go to shared notification toasts/history, without a duplicate page-top banner; explicit structural validation and localized persistent workflow/file states retain their contextual display.

C source analysis also caps aggregate source text, function counts and retained diagnostics. New reference excerpts are bounded while retaining original reference IDs and source hashes; full source remains with its owning records. Analysis/question data and invalid reports count toward the upload admission budget. It scans signatures without backtracking, and uses precomputed line offsets. The ZIP reader validates the complete central directory before decompression, rejects unsafe/absolute/duplicate paths and header mismatches, and bounds each inflate operation even if sizes are dishonest. Hard limits and per-user/activity rates, storage allowances, concurrency limits, and minimum free space are specified in [Security boundaries](../../../../docs/SECURITY_BOUNDARIES.md). Migration `202610250010_bounded_upload_requirements` caps older oversized requirement settings; archive/file limits remain configurable below the hard ceilings.

Students cannot invoke internal submission analysis. Student payloads omit reference provenance, private metadata, stored filesystem names, and raw processing errors. They cannot select an alternate documentation snapshot for grading. Staff retain private diagnostics and the existing scoped grading interfaces.

## Shared Markdown safety

Prompts and feedback use the shared renderer’s fixed attribute-free HTML allowlist and bounded, untrusted math. Raw attributed HTML is displayed literally; retain ordinary Markdown links, images, tables, and formatting. See [the shared rendering contract](../../../../docs/plugin-authoring/03-core-services.md#what-markdownrenderer-gives-you).

## Dialog presentation

Authoring, confirmation, submission, and review dialogs reuse the [shared persistent header and close cross](../../../../docs/DIALOGS.md). The host review toolbar keeps navigation, messages, and dismissal on one row; embedded review panels leave the modal boundary and close action to that host. Existing draft guards, busy states, and non-dismissible progress remain in force.

## Static signature validation

The C parser now supplies normalized argument and return types alongside its existing source/AST records. Requirement entries optionally carry `parameterTypes` and `returnType`; older name-only entries remain valid. Signature mismatches are reported distinctly. `codingHomeworkSubmissionReadiness` separates acknowledgement-based academic gaps (missing files/folders/functions, mismatched signatures and syntax diagnostics) from hard archive, extension and resource-limit failures; at least one valid file is required. The preparation/hand-in workflow consumes this classifier; existing strict preflight `isValid` semantics remain unchanged.

## Prepared files and private solution

The preparation API stores a revisioned, plugin-owned file collection without creating a core attempt. Individual files may target relative folders; same-path replacement requires confirmation. ZIP replaces the complete collection. Optimistic revisions and an advisory workflow lock protect concurrent tabs; immutable physical objects are validated against recorded size/hash. Final workflows freeze preparation until teacher cancellation. Collection size is conservatively bounded by the configured archive-byte limit, in addition to ZIP expansion and parser limits.

Private teacher solutions accept C/H files or ZIPs, retain parsed function signatures, and support an AI selector constrained to known candidate keys. Header-only or definition-free files may be uploaded first. Only authorized authoring owners can access them. Duplication copies independent solution records and clears operational submission/reference readiness settings.

A ZIP explicitly replaces the complete private solution and preserves its relative paths (there is no automatic wrapper-folder stripping). Individual files merge/replace their normalized path and refresh only their own detected functions. Finder `__MACOSX` and AppleDouble `._*` metadata files are excluded. UTF-8 and BOM-marked UTF-16 are decoded before persistence; binary/control-NUL and malformed source produce actionable validation errors without overwriting the previous solution. C source remains within the bounded analysis limits.

The private endpoint returns a content revision. Uploads accept an optional `expectedRevision` for compatibility; the UI always sends it. DELETE requires it and accepts `kind: file` plus `path`, `kind: function` plus `key`, or `kind: all`. Owner-scoped locks serialize mutations; stale revisions return 409. Removing a file also removes its detected functions. Removing a function changes only the selectable catalog, leaving its original source intact; it stays excluded across unrelated uploads and returns if that source file is uploaded again. Clearing/replacing a solution requires UI confirmation.

Solution changes and linked saved-requirement reconciliation commit together. Removed solution paths/functions are pruned; retained selected signatures are refreshed, and unrelated hand-authored requirements remain. The editor applies the same reconciliation to its draft and saved baseline so Cancel cannot restore deleted references or discard unrelated edits. Private solution changes are blocked while final submissions are enabled. Checkboxes use compact shared homework choice rows with wrapping paths/signatures and separate Remove controls.

The Assignment PDF area is labelled Preview and embeds the authorized `activity-file` response. API transport preserves a plugin’s Response stream, MIME type, disposition and status while applying host CORS/cache policy. Student content closure still rechecks authorization and cancels a discarded file stream rather than exposing it. Bank, course and learner file routes therefore deliver actual PDF/download bytes rather than a JSON serialization of the Response object.

The shared deferred-assessment contract lets this activity declare preparation routes outside the SEB/timer start gate. Assessment routes remain guarded; only an explicit verified answering action may start the clock. The current student workspace uses these routes; acceptance evidence is tracked in the implementation progress document.

## Explicit AI choices

Protected workflow settings `embeddingAi` and `questionGenerationAi` store allowlisted model selections created server-side; generic authoring saves cannot inject them. Embedding changes clear the prepared selection and are locked during submission opening. Generation changes preserve references and affect only new submissions. Hand-in metadata pins its generation selection, and documentation snapshots pin embedding selections. Core enforces course access, active credential ownership, catalogue purpose and endpoint identity. Bank copies strip both choices. Legacy empty embedding metadata uses the original compatible model/dimensions. See [AI connection contracts](../../../../docs/AI_MODEL_CONNECTIONS.md).

## Challenge code context, instructions and teaching language

Current and legacy student answering render the same `HomeworkChallengeQuestion` card. Each has a distinct border/accent, tinted header with localized “Question N of M”, the Markdown question first, then framed code context and a visible “Your answer” label. A 28 px gap separates cards. At a card width of 48 rem or more, code and answer share a row; narrower cards stack them. The source frame caps height at 22 rem, preserves indentation, scrolls long lines internally and accepts keyboard focus. Filename/function metadata wraps independently from code. The answer field's accessible name includes its question number and its description references the prompt. Existing values, answer IDs, autosave, time-limit disabling and completed states are retained; this also improves already-generated question sets without regeneration.

Every newly generated question retains a `studentCodeContext` snapshot with only submitted code, filename/function name, language and truncation status. `answering` and submission history project these allowlisted fields; already-generated questions can use their retained submitted-function/file relation without regenerating academic content. Both relations must match the question’s submission. The code is rendered read-only with shared syntax highlighting and line numbers. Excerpts are limited to 24,000 characters, matching generation evidence; truncated contexts point students to the complete submitted-file viewer. When parsing yields no function, use the bounded submitted-code context that was sent to generation. The question and context remain unavailable before Answer and the applicable SEB gate.

The existing private `generationInstructions` field is edited in Settings for course homework (Activity for bank authoring). It shares the ordinary activity draft, save and discard boundary and remains server-side. Both generation paths place it in the system prompt as authoritative question policy, ahead of assignment/reference suggestions; code/references are evidence, not instructions. The fixed response schema, course language and privacy constraints remain mandatory.

New hand-ins snapshot `questionLanguage` from `Course.subject.teachingLanguage`. A legacy `locale` request field remains accepted for client compatibility but does not choose question language. Prepared retries use the snapshot; older queued work without it resolves the current course teaching language. Legacy teacher generation also resolves that language server-side. UI labels continue to follow the user’s session locale. Existing question wording is not automatically replaced; changes to language/instructions apply to new submissions. No schema migration is needed.

## Student checks and resource downloads

Preparation shows **Check my submission** rather than an automatic requirements list. A fresh GET preparation validation supplies the result; a valid structure shows a checkmark, while an incomplete structure shows an alert icon and all missing/mismatched requirements. The UI explicitly explains that filenames/function signatures are checked, not execution or solution correctness. Submit appears only for the current checked draft, either structurally valid or with the explicit incomplete-work checkbox selected. File changes reset both the result and acknowledgement; a new page visit requires a fresh check. The teacher submission gate still applies. Submission confirmation states that submitted work cannot be changed, and hand-in independently validates the actual frozen files.

Student assignment resources use two conditional buttons: assignment PDF and provided files ZIP. The ZIP route uses the same owner/course/group authorization and preparation-phase access as individual activity files, with ordinary content closure enforced by the host. It selects only `provided_file` attachments, streams stored ZIP entries with bounded 64 KB reads, checks actual sizes and SHA-256, and closes descriptors on completion/cancellation. Limits are 1000 files, 25 MB per file and 256 MB combined. Entry names are basenames with control characters removed; duplicate names are retained with numbered suffixes. A single provided ZIP is downloaded unchanged instead of wrapped. No archive is extracted, no submitted/teacher-solution files are included, and no persistent generated archive is stored. PDF teacher previews remain inline; the student download button requests attachment disposition.

Bulk removal uses the existing student workflow lock and frozen-submission guard. Files/folders are emptied in one draft update and the revision advances once; obsolete draft bytes are unlinked only after commit. Existing submitted copies and academic history are untouched.

## Understanding-focused challenge design

Questions test the student's understanding of their actual submitted implementation. Each targets one focused issue whose complete explanation fits in about 2–3 sentences. The intended author should be able to answer from the displayed code and course-level concepts, without a long trace, proof, rewrite, exhaustive case analysis, obscure rule or missing context. This guides question selection; it does not impose a sentence-count validator on student answers.

Examples of suitable forms include a small concrete parameter/input case (including relevant valid boundary values), explaining an existing condition/guard/loop bound, and explaining a local variable, update, branch or helper call. These are options, not a mandatory template; both generation paths supply earlier questions to encourage varied focus within teacher instructions. Cases must respect known preconditions and visible facts. Do not invent hidden state/helper behavior or ask why an incorrect/undefined result is correct. Simplify an overcomplicated question before returning it. The current prompt versions are `prepared-homework-v5` and legacy challenge `v4`; existing question sets are not regenerated automatically.

## Excluding unchanged provided code

Only the activity's `provided_file` attachments define starter code. Read individual C/H files and C/H members of provided ZIPs, including nested folders; ignore unrelated binary entries and macOS metadata. The private teacher solution and course reference material never define exclusion. Both generators filter exact unchanged functions before candidate selection; legacy analysis also filters before embeddings/ranking. Moving a function to another path does not make it eligible.

Comparison uses SHA-256 of C tokens with whitespace/comments removed. Identifier, type, operator, number, character and string tokens remain significant. Even a changed literal makes a function eligible; this is not semantic equivalence or plagiarism detection. Do not reuse normalized AST fingerprints, which deliberately erase literal values for similarity search. Source decoding accepts UTF-8 and BOM-marked UTF-16. Static parsing retains its normal limits and does not execute/preprocess code.

Enablement validates/primes the baseline. Hand-in freezes `metadata.providedCode`: schema version, attachment-version hash, whole-source hashes and function name/hash pairs. **No provided-file bytes are copied for each submission.** A bounded process cache (32 attachment versions, including in-flight promises) reuses reads/parsing; identical submissions retain their own compact manifest for durable retries. Cache invalidation follows attachment IDs, hashes, names and MIME types. Provided uploads/deletions and hand-in share the settings lock. Later edits affect future hand-ins, while queued work retains its saved hashes. Old queued/legacy submissions without a manifest capture current provided files once; an invalid saved manifest fails rather than silently changing the baseline. Completed question sets are not rewritten. This uses existing metadata and requires no schema migration.

Comparison permits at most 1000 attachments, 25 MB per attachment, 256 MB aggregate input, 1000 C/H sources, 2 million source characters and 2000 parsed functions. Attachment reads verify size and SHA-256 through the shared bounded chunk reader used by downloads. Source-only ZIP reads skip unrelated binaries without inflating them; selected source entries still obey path/header/expansion limits. Ordinary student ZIP validation continues to inspect all entries.

If parsed functions are all excluded, generation must not fall back to the full starter files. If provided functions exist but no eligible submitted definition can be parsed, it also stops for teacher review. The retained incomplete-work fallback only applies when neither side has parsed functions and at least one submitted source differs from provided source. No eligible code produces non-retryable `HOMEWORK_NO_ELIGIBLE_CODE`, makes no model call, retains the frozen submission, and projects only `generationIssue: no_eligible_code` with a localized learner message. The teacher can review/cancel to permit a corrected submission; no invented questions or automatic grade is produced.

Prompts constrain questions to the eligible code context and list excluded provided names. A bounded output check rejects explicit references to those names, with special handling so ordinary words such as “main control flow” are not mistaken for `main()`. Invalid outputs retry within the existing generation limit; this supplements deterministic candidate exclusion without claiming semantic validation of every model sentence. Baseline hashes, excluded counts and raw diagnostics remain private.
