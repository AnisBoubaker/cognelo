# Coding Homework Grader Implementation Plan

This plan describes the phased implementation of the new Coding Homework Grader activity plugin.

The existing `plugin-coding-homework-grader` package is currently a renamed scaffold with a plugin-owned persistence foundation. The product direction is to turn it into a full programming-homework submission workflow:

- Teachers define the homework statement as editable text or an uploaded PDF.
- Teachers add and assign the activity through the normal course content and gradebook workflow.
- Course content resources that appear before the assignment in the content tree are treated as the documentation/class examples available to students.
- Students submit homework files, usually a ZIP archive.
- The plugin generates challenge questions based on structural differences between submitted code and prior course material.
- Students answer the challenge questions.
- The submission is then ready for teacher grading.

## Source Material

This plan is based on:

- `tmp/K0094_paper.pdf`
- `tmp/latex_source/icetm2024.tex`
- the prototype under `tmp/challenge-questions/scripts`
- the existing scaffold under `packages/plugin-activities/plugin-coding-homework-grader`
- the current activity plugin, content type plugin, content tree, and gradebook architecture

The Python prototype maps to these future TypeScript modules:

- `0_data_cleanup.py` -> source normalization and comment stripping
- `1_parse_code.py` -> code parsing, AST serialization, and function extraction
- `2_generate_corpus_embeddings.py` -> reference corpus indexing
- `3_compute_similarities.py` -> submission/reference similarity search
- `4_select_candidates.py` -> divergent function candidate selection
- `5_generate_questions.py` -> RAG-backed challenge question generation

The implementation must be TypeScript/Node/Postgres-native. The Python prototype is only a behavioral reference.

## Implementation Progress

As of June 17, 2026:

- Phase 0 is complete: prototype-to-TypeScript algorithm contracts, prompt versioning, plugin README, and plugin memory were added without production dependency on `tmp`.
- Phase 1 is complete: the former homework grader scaffold was renamed to Coding Homework Grader with package name `@cognelo/plugin-coding-homework-grader`, plugin key `coding-homework-grader`, activity key `coding-homework-grader`, and database namespace `plugin_coding_homework_grader`.
- Phase 2 is complete: the plugin-owned Prisma schema, generated client, activation migration manifest, and table registration were added for authoring, requirements, artifacts, documentation snapshots, submissions, generated challenge questions, and teacher reviews. `npm run db:migrate:all` succeeds with the new plugin migration.
- Phase 3 is complete: teacher authoring routes and UI were added for Markdown prompt editing, assignment PDF upload, structure requirements editing/import, preview, and bank-to-course copy of authored plugin records.
- Phase 4 is complete: course documentation preview and snapshot creation were added for visible prior content resources before the activity's content-tree anchor.
- Phase 5 is complete: content-type plugins now expose extracted embedding documents through a shared server interface, and the Coding Homework Grader extracts snapshot sources only through that interface.
- Phase 6 is complete: a language-neutral parser registry and first C parser adapter were added with deterministic normalized AST text, function extraction, and recoverable diagnostics.
- Phase 7 is complete: ZIP archive reading, structure validation, student/teacher preflight upload, temporary preflight artifacts, and validation summary UI were added. Final submissions will reuse the same validation service in Phase 9.
- Phase 8 is complete: shared content vector contracts, deterministic development embeddings, content-plugin-owned vector indexing/search handlers, core vector search dispatch, and Coding Homework Grader reference search were added.
- Phase 9 is complete: students can load the assignment prompt, upload a final ZIP from the assigned activity route, receive structure feedback, and create durable plugin submission/file records for valid archives.
- Phase 10 is complete: valid final submissions can be analyzed into parsed submitted functions, deterministic dev embeddings, nearest reference examples from the shared content vector dispatcher, divergence scores, and selected candidate rows.
- Phase 11 is complete: teachers can trigger or retry server-side challenge question generation for analyzed submissions. Generated questions are stored with prompt version, model, selected function provenance, nearest-example audit metadata, and submission status moves to `challenge_ready`.
- Phase 12 is complete: valid student ZIP submissions now run analysis and challenge generation immediately, return student-safe challenge questions, collect draft/final answers, and mark the plugin submission `ready_for_grading` once every question is answered.
- Phase 13 is complete: final answer submission creates/submits a core gradebook attempt for summative assignments, and teachers can review coding homework submissions from the gradebook manual grading surfaces.

## Product Boundaries

### In Scope

- A real activity plugin named Coding Homework Grader.
- Teacher authoring for assignment text and assignment PDF.
- Student ZIP upload.
- Server-side ZIP validation and extraction.
- C-first code analysis using a TypeScript/Node parser pipeline.
- A parser adapter roadmap so additional languages can be added after the first C implementation.
- Teacher-defined submission structure requirements for expected files, folders, and functions.
- A temporary student preflight upload/check flow that validates structure without creating a final submission.
- Course documentation snapshot from prior content resources.
- AST serialization and embedding.
- Retrieval of closest prior examples.
- Divergent candidate selection.
- LLM-generated challenge questions.
- Student answers to generated challenge questions.
- Teacher review and manual grading.
- Core gradebook integration for summative submissions.
- Long-term production object storage for homework artifacts.
- A global cross-course embeddings/indexing service for reusable course context retrieval.

### Out Of Scope For The First Complete Version

- Fully automatic grading of challenge answers.
- Full plagiarism adjudication.
- Multi-language parser parity beyond the first C implementation.
- Real-time student code execution.
- Direct reuse of the Python prototype in production.

## Key Architecture Principles

- Keep plugin behavior isolated in `packages/plugin-activities/plugin-coding-homework-grader`.
- Keep plugin-owned persistence in plugin-owned tables and migration manifests.
- Do not add Coding Homework Grader columns to core course, activity, content, attempt, or grade tables.
- Use core only for generic course/activity/assignment/content/gradebook orchestration.
- Use content type plugin embedding descriptors through core services rather than importing concrete content type plugins.
- Treat vector storage and similarity search as a shared platform capability, not as Coding Homework Grader-only infrastructure.
- Let content type plugins own extraction, chunking, source-specific metadata, and invalidation decisions behind a unified content type plugin interface.
- Let shared platform vector services own production embedding persistence, model/version bookkeeping, indexing, and cross-content-type score merging.
- Let activity plugins request vector-based similarity through core/content-plugin dispatchers instead of reading content-plugin embedding tables directly.
- Store uploaded and generated artifacts behind a storage abstraction so local development storage can evolve into production object storage without rewriting plugin workflows.
- Prefer Postgres/pgvector for production vector storage so development can stay close to the existing Postgres setup while still supporting indexed similarity search at scale.
- For the pgvector migration, prefer common platform vector tables over one vector table per content plugin. Content plugins should own extraction/chunking semantics and submit documents/chunks to the shared vector service; core owns authorization-aware retrieval across all course content types.
- Store historical snapshots for assignment documentation and generated questions so later content edits do not mutate an existing submission record.
- Use existing AI agent connection patterns for server-side generation; never expose provider keys to the browser.
- Register every authoring/settings form with `useUnsavedChangesGuard`.

## Naming And Rename Strategy

Phase 1 renamed the user-facing activity from Homework Grader to Coding Homework Grader.

Recommended package/API rename:

- Package directory: `packages/plugin-activities/plugin-coding-homework-grader`
- Package name: `@cognelo/plugin-coding-homework-grader`
- Plugin key: `coding-homework-grader`
- Activity type key: `coding-homework-grader`
- Database namespace: `plugin_coding_homework_grader`

Because the current coding homework grader is a scaffold with no plugin-owned production data, this can be treated as a clean rename during development. If local scaffold records exist, add a small migration/seed cleanup note rather than a full compatibility layer.

Keep a short transition checklist:

- Update TypeScript path aliases in `tsconfig.base.json`, `apps/web/tsconfig.json`, and `apps/api/tsconfig.json`.
- Update `apps/api/next.config.mjs`.
- Update `vitest.config.mts`.
- Update `packages/activity-sdk/src/index.ts`.
- Update `packages/activity-sdk/src/server.ts`.
- Update `packages/activity-sdk/package.json`.
- Update package-lock after package rename.
- Update plugin authoring handbook references.
- Update plugin README and plugin memory.

## Data Model Sketch

The exact Prisma names can evolve, but the plugin should start with these concepts.

### Authoring Tables

`PluginCodingHomeworkAssignment`

- `id`
- `activityId` unique
- `promptMarkdown`
- `promptPdfAttachmentId`
- `languageKey`
- `candidateLimit`
- `retrievedExampleCount`
- `questionCount`
- `generationInstructions`
- `settings` JSON
- timestamps

`PluginBankCodingHomeworkAssignment`

- `id`
- `bankActivityId` unique
- same authoring fields as course assignment
- timestamps

`PluginCodingHomeworkSubmissionRequirementSet`

- `id`
- `activityId` unique
- `languageKey`
- `requirements` JSON
- `sourceAttachmentId`
- `metadata` JSON
- timestamps

`PluginBankCodingHomeworkSubmissionRequirementSet`

- `id`
- `bankActivityId` unique
- same requirement fields as course requirement set
- timestamps

`requirements` should support teacher-authored or uploaded requirements such as:

- required files
- required folders
- allowed or ignored paths
- required functions per file
- optional functions per file
- allowed extensions
- maximum file count and archive size
- language-specific parser expectations

The first implementation stores requirements as JSON while exposing a structured editor/import flow in the plugin UI.

`PluginCodingHomeworkAttachment`

- `id`
- `ownerKind`: course activity, bank activity, or submission
- `ownerId`
- `kind`: assignment PDF, requirements upload, submission ZIP, extracted source, extracted non-source
- `originalName`
- `storedName`
- `mimeType`
- `size`
- `sha256`
- `metadata` JSON
- timestamps

### Documentation Snapshot Tables

`PluginCodingHomeworkDocumentationSnapshot`

- `id`
- `activityId`
- `courseId`
- `groupId` optional
- `contentTreeAnchorItemId`
- `contentTreeFingerprint`
- `status`
- `metadata` JSON
- timestamps

`PluginCodingHomeworkReferenceFunction`

- `id`
- `snapshotId`
- `contentResourceId` optional
- `sourceTitle`
- `sourceKind`
- `languageKey`
- `functionName`
- `functionCode`
- `astText`
- `embeddingRef` or vector index metadata, when the reference is materialized from content-plugin search results
- `metadata` JSON
- timestamps

Reference embeddings should not become a Coding Homework Grader-only JSONB store. Prior course content belongs to the platform content system, so content plugins should extract/chunk their own resource content and submit those documents to a shared vector service. The Coding Homework Grader can store snapshots of selected/reference functions and nearest-example metadata for auditability, but similarity search over course content should be requested through the platform dispatcher. Submitted homework functions may still be plugin-owned artifacts because they are assessment submissions, but their embedding writes should use the same shared vector service conventions.

### Planned Pgvector Migration Notes

The current deterministic vector implementation is temporary development infrastructure. Before implementing the pgvector migration, revisit these notes and resolve the open decisions below.

Preferred architecture:

- Use shared platform vector tables rather than one table per content type plugin.
- Content type plugins own extraction, chunking, source-specific metadata, and invalidation decisions.
- Core/shared vector services own embedding persistence, model/version bookkeeping, indexes, authorization-aware search, and score merging across content types.
- Activity plugins call core retrieval/search services and never query vector tables directly.
- Coding Homework Grader stores only assessment/audit metadata such as retrieved chunk IDs, exact retrieved text/code, nearest-example scores, and generated-question provenance.

Likely common tables:

`ContentEmbeddingDocument`

- `id`
- `contentResourceId`
- `contentTypeKey`
- `pluginKey`
- `documentKey`
- `title`
- `text`
- `kind`
- `languageKey`
- `path`
- `metadata` JSON
- `contentFingerprint`
- timestamps

`ContentEmbeddingVector`

- `id`
- `documentId`
- `modelKey`
- `dimensions`
- `embedding vector(dimensions)`
- `metadata` JSON
- timestamps

Migration tasks:

- Switch the dev Postgres image from `postgres:16-alpine` to an image/build that includes pgvector.
- Add a core migration with `CREATE EXTENSION IF NOT EXISTS vector`.
- Add shared vector/document tables and HNSW or IVFFlat indexes.
- Use Prisma `Unsupported("vector(...)")` or raw SQL for vector columns because Prisma does not model pgvector as a normal scalar.
- Replace deterministic metadata indexes inside content plugins with writes/searches through the shared vector service while preserving `indexEmbeddingDocuments` and `searchEmbeddingDocuments` contracts.
- Add benchmark fixtures for course-scoped and group-scoped filtered retrieval.

Pending decisions before migration:

- Embedding provider and model key for the first real implementation.
- Vector dimensions, which depend on the chosen embedding model.
- Whether one table per dimensions/model family is simpler than a single table with multiple vector columns or partitioning.
- Whether submitted homework functions use the same shared vector table or a separate assessment-scoped table with the same service contract.
- Which index type to start with. Recommended default: HNSW for operational simplicity, then benchmark IVFFlat/partial indexes if filtered course queries need it.
- How content fingerprinting and reindex invalidation should behave when content resources are edited.
- Whether indexing runs synchronously on save/upload for small resources or through a background job queue.

### Submission And Challenge Tables

`PluginCodingHomeworkSubmission`

- `id`
- `activityId`
- `groupId`
- `userId`
- `coreAttemptId` optional
- `documentationSnapshotId`
- `zipAttachmentId`
- `kind`: preflight or final
- `status`: uploaded, validating, invalid_structure, structure_valid, processing, challenge_ready, answered, ready_for_grading, graded, failed
- `structureValidationSummary` JSON
- `processingError`
- `metadata` JSON
- timestamps

`PluginCodingHomeworkSubmissionFile`

- `id`
- `submissionId`
- `path`
- `languageKey`
- `size`
- `sha256`
- `storedName`
- `metadata` JSON

`PluginCodingHomeworkSubmissionFunction`

- `id`
- `submissionId`
- `fileId`
- `functionName`
- `functionCode`
- `astText`
- `embeddingRef` or plugin-owned submission vector metadata
- `nearestExamples` JSON
- `divergenceScore`
- `selectedForQuestion`
- timestamps

`PluginCodingHomeworkChallengeQuestion`

- `id`
- `submissionId`
- `submissionFunctionId`
- `orderIndex`
- `questionText`
- `studentAnswer`
- `answerSubmittedAt`
- `generationModel`
- `generationPromptVersion`
- `nearestExamples` JSON
- `metadata` JSON
- timestamps

`PluginCodingHomeworkReview`

- `id`
- `submissionId`
- `reviewerUserId`
- `score`
- `maxScore`
- `feedback`
- `rubric` JSON
- timestamps

## Content Context Rule

The documentation context must be deterministic and reviewable.

Initial rule:

- Find the course content tree item that represents the Coding Homework Grader activity.
- Flatten the course content tree using the same ordering rules as the teacher content page.
- Include visible content resources that appear before the activity item in that flattened order.
- Exclude folders, hidden content, content after the activity, unavailable plugin resources, and other activities.
- For assigned group activity attempts, use the group-visible content tree when available, but still anchor the prior-content cutoff to the course activity placement.
- Store the list of included content item/resource IDs and resource fingerprints in `PluginCodingHomeworkDocumentationSnapshot`.

Open decision:

- Decide whether group-specific content resources that appear before the assigned activity in the group tree should also be included. The safer first version is course-level prior resources only, then add group-specific resources once the review UI can explain the exact source set to teachers.

## Challenge Generation Method

The production implementation should preserve the research method but make each step inspectable.

0. Validate submission structure.
   - Compare extracted ZIP contents with teacher-defined submission requirements.
   - Check required files, folders, allowed extensions, and required functions.
   - Record missing, unexpected, unparseable, and valid elements.
   - Allow the same validation service to run in preflight mode without creating a final attempt.

1. Build a reference corpus from prior course content.
   - Resolve each prior content resource through core's generic content embedding-document dispatcher.
   - Let each owning content type plugin extract text, documents, code blocks, source files, or diagnostics in its own way.
   - Let content type plugins own extraction/chunking and use the shared vector service for production embedding persistence and vector search.
   - Store snapshot references, retrieved chunk/function IDs, exact text/code used for generation, and nearest-example metadata for auditability.

2. Process a student submission.
   - Validate ZIP size, file count, path safety, and allowed extensions.
   - Validate the archive structure against teacher requirements.
   - Extract supported source files.
   - Normalize source.
   - Parse functions.
   - Serialize ASTs.
   - Embed each submission function AST.

3. Compute similarity.
   - Compare each submitted function against reference functions.
   - Store nearest examples with distances.
   - Rank functions by highest distance from the nearest class examples.

4. Select candidates.
   - Select the top `candidateLimit` functions, default 5.
   - Prefer diversity across files/functions when many functions have similar scores.
   - Keep teacher-visible diagnostics showing why each function was selected.

5. Generate questions.
   - For each selected function, retrieve the nearest `retrievedExampleCount` reference functions, default 3.
   - Send the student function and reference examples to the configured AI model.
   - Ask for exactly one free-response challenge question.
   - Store prompt version, model, generated text, selected function, and retrieved examples.

6. Collect answers.
   - Students see generated questions only after uploading the submission.
   - Once questions are shown, the ZIP should be locked for that attempt.
   - Students answer all required questions and submit.
   - The plugin marks the submission `ready_for_grading`.

## Parser Strategy

Phase one should support C assignments because the research prototype and paper use C.

Recommended approach:

- Add a parser adapter interface in the plugin.
- Implement a C adapter first.
- Treat C as the first production implementation, not as a permanent language limit.
- Model assignment requirements and extracted functions with language-neutral shapes so later parser adapters can validate other languages.
- Use a TypeScript/Node-compatible parser such as Tree-sitter with a C grammar if it works cleanly in the app/build environment.
- Keep AST serialization stable and deterministic.
- Treat preprocessing as a best-effort normalization step, not a full compiler pipeline.
- Record parse errors and unsupported files in submission metadata instead of failing the whole submission when at least some functions can be parsed.

Future parser adapters can support C++, Python, JavaScript, Java, or other languages without changing the submission workflow.

## Plugin Routes

All routes should live in the plugin and be dispatched through the generic activity route dispatcher.

Suggested route paths:

- `coding-homework-grader/assignment`
  - `GET`: load teacher assignment settings
  - `PUT`: save teacher assignment settings
- `coding-homework-grader/assignment-pdf`
  - `POST`: upload assignment PDF
  - `DELETE`: remove assignment PDF
- `coding-homework-grader/documentation-preview`
  - `GET`: teacher preview of prior resources that will be used as documentation
- `coding-homework-grader/submission`
  - `GET`: student submission/challenge status
  - `POST`: upload ZIP and start processing
- `coding-homework-grader/submission-analysis`
  - `POST`: rerun submitted-function parsing, nearest-example retrieval, divergence scoring, and candidate selection
- `coding-homework-grader/challenge-generation`
  - `POST`: teacher-only generation/retry for challenge questions from selected submitted functions
- `coding-homework-grader/preflight`
  - `POST`: temporarily upload ZIP and validate files, folders, and required functions without final submission or question generation
- `coding-homework-grader/challenge-answers`
  - `PUT`: save draft answers
  - `POST`: submit final answers and mark ready for grading
- `coding-homework-grader/submission-file`
  - `GET`: teacher-only download of original ZIP or extracted source file
- `coding-homework-grader/gradebook-attempts`
  - `GET`: teacher-only detailed attempts for manual grading panels
- `coding-homework-grader/reprocess`
  - `POST`: teacher-only retry for failed processing or question generation

## Frontend Surfaces

### Teacher Authoring

- Rename existing scaffold labels to Coding Homework Grader.
- Add teacher authoring renderer.
- Assignment statement tab:
  - Markdown editor for prompt text.
  - PDF upload.
  - Preview of current student-facing statement.
- Submission requirements tab:
  - structured editor for required files, folders, and functions
  - upload/import option for a requirements file
  - validation preview using a sample ZIP
  - language selector, with C implemented first and more languages planned through parser adapters
- Challenge generation tab:
  - language selector, initially C only
  - candidate limit
  - nearest examples count
  - question count
  - optional extra generation instructions
  - documentation preview
- Save through plugin route and `useUnsavedChangesGuard`.

### Student View

State-driven UI:

- Before available: use normal core assignment availability.
- No submission: show homework statement, structure requirements, temporary conformance check, and final ZIP upload.
- Preflight check: students may temporarily upload a ZIP to verify required files, folders, and functions before final submission; these checks do not create gradebook attempts or challenge questions.
- Processing: show progress/status.
- Challenge ready: show generated free-response questions.
- Ready for grading: show submitted ZIP metadata and submitted answers, read-only.
- Graded: show released grade only through normal gradebook release behavior.

### Teacher Review

- Add manual grading renderer for detailed gradebook pages.
- Show:
  - student ZIP download
  - extracted source file browser
  - generated questions
  - student answers
  - selected function code
  - nearest prior examples used for generation
  - divergence scores
  - teacher score and feedback fields
- Support save, regrade/review, and delete attempt through existing gradebook patterns where possible.

## Gradebook Integration

Declare grading capability:

- supports attempts
- supports manual grading
- supports analytics payloads
- no automatic grading in the first complete version

Submission flow:

- For summative assignments, create a core attempt when the challenge-answer set is finalized.
- Prefer final answer submission as the core submission point so incomplete challenge flows do not count as submitted work.
- Store plugin submission ID as `pluginAttemptRef`.
- Mark the core attempt submitted only when challenge answers are final.
- Manual grading writes normalized grades through existing core grade services.

Later phase:

- Add automated answer assessment as advisory feedback, not final grading, until teacher review rules are validated.

## Phased Delivery

### Phase 0: Research And Prototype Distillation

Deliverables:

- Document the prototype-to-TypeScript mapping in the plugin README.
- Capture the algorithm as stable plugin service interfaces.
- Add prompt versioning notes for question generation.

Acceptance:

- The implementation team can identify which prototype script maps to which TypeScript module.
- No production code depends on `tmp`.

### Phase 1: Rename Scaffold To Coding Homework Grader

Deliverables:

- Rename package, plugin key, activity type key, display name, i18n metadata, and docs.
- Update SDK registries, TypeScript aliases, API/web config, Vitest aliases, and lockfile.
- Update tests that previously expected the old homework-grader scaffold.

Acceptance:

- The picker shows Coding Homework Grader under Programming.
- The old no-op scaffold test is replaced with a renamed manifest test.
- Typecheck passes.

### Phase 2: Plugin-Owned Persistence Foundation

Deliverables:

- Add plugin Prisma schema and generated client.
- Add plugin database module with activation migrations.
- Add assignment, bank assignment, submission requirement, bank submission requirement, attachment, snapshot, reference function, submission, submission file, submission function, question, and review tables.
- Add backup/deactivation coverage through existing plugin lifecycle.

Acceptance:

- Plugin activation creates all tables.
- Plugin deactivation backs them up.
- `npm run db:migrate:all` succeeds.

Progress:

- Added `prisma/schema.prisma`, `src/db.ts`, `src/db-client.ts`, generated Prisma client output, and `prisma/migrations/202605280010_baseline/migration.sql`.
- Registered 12 plugin-owned tables in the activity plugin database manifest so existing activation/deactivation backup logic can see them.
- Verified `npm run db:migrate:all` applies `coding-homework-grader/202605280010_baseline` and regenerates the plugin Prisma client.
- Kept route handlers, storage behavior, teacher authoring, and bank-to-course copy hooks for later phases.

### Phase 3: Teacher Assignment Authoring

Deliverables:

- Teacher authoring renderer.
- Markdown assignment text editing.
- Assignment PDF upload route.
- Submission requirements editor for required files, folders, allowed paths, and required functions.
- Requirements upload/import flow.
- Assignment preview.
- Bank-to-course copy hook for authored prompt/PDF/settings.

Acceptance:

- Teachers can author an activity in an activity bank.
- Adding from a bank copies assignment settings into course-owned plugin rows.
- Adding from a bank copies submission requirements into course-owned plugin rows.
- Course-local edits do not mutate bank-owned rows.

Progress:

- Added `coding-homework-grader/authoring`, `coding-homework-grader/assignment-pdf`, and `coding-homework-grader/requirements-upload` plugin routes for course and activity-bank contexts.
- Added `src/web/coding-homework-grader-activity-view.tsx` and registered it with the web activity renderer registry for course activities and bank activity authoring.
- Added local plugin messages for English, French, Chinese, and Arabic authoring copy.
- Added bank-to-course and bank-delete hooks in `src/server.ts`; authored assignment, requirement-set, and attachment metadata rows are copied into course-owned rows on assignment.
- Kept student submission, documentation snapshot generation, object-storage migration, and parser/embedding processing for later phases.

### Phase 4: Prior Documentation Snapshot

Deliverables:

- Service to resolve the course content tree anchor for the activity.
- Service to list prior content resources.
- Documentation preview route.
- Snapshot table writes with content fingerprints.

Acceptance:

- Teacher preview clearly lists which course resources will be used.
- Snapshot contents are stable after creation.
- Hidden/unavailable/future content is not included.

Progress:

- Added `src/documentation.ts` to flatten visible course content-tree rows, resolve the activity anchor, list prior content resources in tree order, and fingerprint the exact included resource set.
- Added `coding-homework-grader/documentation-preview` and `coding-homework-grader/documentation-snapshot` plugin routes for course activity contexts.
- Added a teacher-facing prior-documentation preview and snapshot action to the authoring UI; bank activity authoring intentionally does not show this because banks have no course content tree.
- Snapshot rows are written to `PluginCodingHomeworkDocumentationSnapshot` with `ready` status, anchor metadata, included resource metadata, and a content-tree fingerprint.
- Kept content extraction, reference function extraction, parser adapters, and embeddings for later phases.

### Phase 5: Text And Code Extraction From Course Materials

Deliverables:

- Extend the content type plugin server contract with a shared extracted-document interface for embedding/reference-corpus inputs.
- Keep content-specific extraction inside the owning content type plugins.
- Use core content extraction dispatch from the Coding Homework Grader, with no text/file/PDF/GitHub-specific branching in the activity plugin.
- Extract Markdown/text content through the text content plugin.
- Extract uploaded plain text, source-like files, and basic PDF text through the file content plugin.
- Let URL/repository content plugins return generic external-reference documents and diagnostics until deeper indexing is implemented by those plugins.
- Store extraction output and diagnostics on the documentation snapshot metadata.

Acceptance:

- Text, file, and basic PDF resources can contribute to the reference corpus through their owning content plugins.
- Unsupported resources are reported but do not crash snapshot creation.
- New content type plugins can participate by implementing the shared extraction interface without changing Coding Homework Grader code.

Progress:

- Added `ContentEmbeddingDocument`, `ContentEmbeddingDiagnostic`, `ContentEmbeddingDocumentsResult`, and `getEmbeddingDocuments` to `@cognelo/content-type-sdk/server`.
- Added `getContentResourceEmbeddingDocuments` in core so activity plugins can request extracted documents through the platform dispatcher.
- Implemented extracted-document handlers in text, file, and GitHub repository content plugins. The file plugin owns source-like text extraction and a basic local PDF text extractor; GitHub repository cloning/source indexing remains inside the GitHub content plugin and is reported as deferred diagnostics for now.
- Added `src/extraction.ts` and the `coding-homework-grader/documentation-extraction` route. Extraction reads `PluginCodingHomeworkDocumentationSnapshot.metadata.includedResources`, calls the generic core interface for plugin-backed content resources, and writes `metadata.extraction` with documents, diagnostics, counts, and timestamps.
- Added a teacher UI action to extract sources from the latest documentation snapshot and display the extracted-document count.
- Legacy material snapshot entries are diagnosed as unavailable for extraction rather than handled with legacy-specific parsing in the Coding Homework Grader.

### Phase 6: C Parser And AST Serializer

Deliverables:

- Parser adapter interface.
- C adapter.
- Language-neutral parser result contracts for files, folders, functions, diagnostics, and AST text.
- Function extraction.
- Stable AST text serialization.
- Parse diagnostics and tests with real C fixtures.
- Document how future language adapters will plug into the same submission requirement and question-generation pipeline.

Acceptance:

- Known C fixture functions produce deterministic AST strings.
- Parse failures are explicit and recoverable.
- The C adapter is the only implemented adapter, but the service interface does not hardcode C-only assumptions.

Progress:

- Added `src/parsers.ts` with a language-neutral parser registry, default parser entry point, and `codingHomeworkCParserAdapter`.
- Implemented conservative C function extraction for top-level function definitions, preserving source path, function code, start/end lines, function name, and language key.
- Added deterministic normalized C AST text serialization with return type, parameters, and comment/string-normalized body tokens for later embedding.
- Added recoverable parse diagnostics for unsupported languages, missing adapters, unmatched braces, unmatched function bodies, and files with no functions.
- Added C parser fixtures covering deterministic AST output, successful extraction before a broken function, and registry behavior for future languages.
- Kept full Tree-sitter or compiler-backed C parsing as a future implementation detail if the build/runtime environment supports it cleanly; the current adapter provides the stable platform contract and testable MVP behavior.

### Phase 7: Submission Structure Validation And Preflight

Deliverables:

- Validation service for teacher-defined required files, folders, extensions, and functions.
- Student preflight upload route and UI.
- Validation summary that separates missing required items, unexpected items, parser errors, and valid items.
- Temporary artifact handling so preflight uploads can be discarded or expire without becoming submissions.
- Teacher-facing sample ZIP validation preview.

Acceptance:

- Students can test a ZIP before final submission without creating a gradebook attempt or challenge questions.
- Final submissions reuse the same validation service.
- Invalid final submissions return actionable structure feedback before challenge generation starts.

Progress:

- Added `src/zip.ts` with a safe ZIP central-directory reader for stored and deflated entries. It rejects unreadable archives, unsafe paths, symlinks, encrypted entries, unsupported compression, truncated entries, and size mismatches before validation consumes file content.
- Added `src/validation.ts` as the shared structure-validation service for required files, required folders, allowed extensions, ignored paths, required functions, parser diagnostics, and counts. It returns separated buckets for missing required items, parser diagnostics, unexpected/unsupported items, ignored files, valid files, and valid functions.
- Added `src/preflight.ts` and the `coding-homework-grader/preflight` route. Preflight uploads require a ZIP, apply the teacher requirement set, parse source files through the language-neutral parser registry, and create `PluginCodingHomeworkSubmission` rows with `kind = preflight` plus temporary ZIP attachments. They do not create core attempts, grades, challenge questions, or final submissions.
- Added student and teacher authoring preflight UI in the Coding Homework Grader renderer. Teachers can upload a sample ZIP while editing requirements; students can upload a temporary ZIP from the activity page to see the same validation summary before final submission exists.
- Final ZIP submission remains Phase 9, but it should call this same ZIP reader and validation service before creating final submission file/function records or starting challenge generation.

### Phase 8: Reference Embedding Index

Deliverables:

- Shared vector service contract for embedding writes and nearest-neighbor search, backed by the existing Postgres setup in development and designed for pgvector in production.
- Content type plugin server interface additions for indexing/searching plugin-owned content documents through the shared vector contract.
- Core dispatch helpers that let activity plugins request vector searches over authorized course content resources without importing concrete content plugins.
- Coding Homework Grader reference-search service that uses the dispatcher to search prior snapshot resources and stores auditable nearest-example metadata in plugin-owned rows.
- Deterministic test vector provider and similarity-ranking tests.

Acceptance:

- Content plugins can own and search vectors for their content resources through the unified interface.
- Coding Homework Grader does not store prior content embeddings in plugin-local JSONB as the primary index.
- Activity plugins can request vector similarity search without knowing which content type plugin owns the underlying storage.
- Distance ranking is deterministic in tests with fixture vectors.

Progress:

- Added `@cognelo/content-type-sdk/vector` with deterministic development embeddings, cosine similarity, vector index construction, and vector index search helpers. This is a development/default implementation behind the shared contract, not a commitment to JSON vectors as the production backend.
- Extended the server content type plugin contract with `indexEmbeddingDocuments` and `searchEmbeddingDocuments` handlers. Content plugins remain responsible for extraction/chunking and resource-specific indexing decisions, while production storage should be backed by the shared vector service.
- Added core helpers `indexContentResourceEmbeddingDocuments` and `searchContentResourceEmbeddingDocuments`. These enforce course/resource authorization and dispatch vector work to the owning content type plugin without activity plugins importing concrete content plugins.
- Implemented vector indexing/search handlers in Text, File, and GitHub Repo content plugins. The current dev implementation stores a deterministic index in each resource's plugin-owned metadata; production should move those internals to shared pgvector tables without changing the activity-facing contract.
- Added `src/reference-search.ts` and the `coding-homework-grader/reference-search` route. The Coding Homework Grader searches the content resources listed in a documentation snapshot through the core dispatcher and stores auditable `latestReferenceSearch` metadata on the snapshot.

### Phase 9: Student ZIP Submission

Deliverables:

- Student upload UI.
- ZIP upload route.
- Size, file count, file extension, MIME, and path traversal validation.
- Structure validation against teacher requirements.
- Safe extraction to local storage.
- Submission status records.

Acceptance:

- Students can upload a ZIP.
- Unsafe archives are rejected.
- Archives that do not conform to required files, folders, or functions are rejected with a validation report.
- Valid archives create plugin submission records and extracted file metadata.

Progress:

- Added `src/submission.ts` with final ZIP submission handling. It reuses the existing ZIP reader and structure validation service, enforces ZIP MIME/name and teacher requirement limits, and resolves the latest ready documentation snapshot for provenance when one exists.
- Added `coding-homework-grader/assignment` and `coding-homework-grader/submission` plugin routes for assigned group activity contexts. Final submissions require a group context; they do not create core attempts, grades, or challenge questions yet.
- Valid final submissions create `PluginCodingHomeworkSubmission` rows with `kind = final`, durable `submission_zip` attachment metadata, local files under `storage/coding-homework-grader/submissions`, and `PluginCodingHomeworkSubmissionFile` rows for extracted valid files.
- Invalid structure submissions create an `invalid_structure` final submission record with the validation summary but do not write the uploaded ZIP or extract files.
- Added student UI wiring to load the assignment prompt, show latest submission status, run the existing preflight check, and submit a final ZIP.

### Phase 10: Submission Analysis And Candidate Selection

Deliverables:

- Parse submitted source files.
- Embed submitted functions.
- Compare to reference functions.
- Store nearest examples and divergence scores.
- Select top candidate functions.

Acceptance:

- Given fixtures, the service selects structurally divergent functions.
- Candidate selection is inspectable by teachers.

Progress:

- Added `src/analysis.ts` with `analyzeCodingHomeworkSubmission`. It loads extracted source files from local submission storage, parses functions through the language-neutral parser registry, embeds submitted AST text with the deterministic dev embedding provider, and stores `PluginCodingHomeworkSubmissionFunction` rows.
- Reference comparison uses `searchContentResourceEmbeddingDocuments` against the submission's documentation snapshot resources; the Coding Homework Grader does not read or own prior-content vector tables.
- Divergence score is the distance to the nearest retrieved reference example. Candidate selection ranks by highest divergence and does a simple first pass to diversify across source files before filling remaining slots.
- Added `coding-homework-grader/submission-analysis` for reprocessing/inspection. The final ZIP submission route now runs analysis automatically for valid submissions and returns the analysis payload.
- Analysis metadata is stored on `PluginCodingHomeworkSubmission.metadata.analysis` with model key, dimensions, source/function counts, selected candidate count, reference resource count, and parser/reference-search diagnostics. The submission remains `structure_valid` until Phase 11 creates challenge questions.

### Phase 11: Challenge Question Generation

Deliverables:

- Prompt builder based on the research prompt.
- Model call through server-side AI connection.
- Question storage with prompt version and retrieved examples.
- Retry/reprocess route for failures.

Acceptance:

- Each generated free-response question is tied to one selected function, up to the assignment's configured question count.
- Students do not see prior examples used for generation.
- Teachers can audit question provenance.

Progress:

- Added `src/generation.ts` with a prompt builder based on the research workflow. The prompt sends the submitted function, normalized AST text, assignment prompt, teacher generation notes, and nearest prior examples to the teacher's configured question-authoring AI agent while instructing the model not to reveal reference examples to students.
- Added `coding-homework-grader/challenge-generation` as a teacher-only assigned-group route. It can retry generation for `structure_valid`, `challenge_ready`, or previously failed submissions that still have selected candidate functions.
- Challenge generation uses the server-side AI connection pattern from core, stores one generated free-response question for each top selected candidate up to the assignment question count, and records the model, `coding-homework-grader.challenge-question.v1`, nearest examples, prompt hash, prompt text, raw model response, selected function name, divergence score, and attempt count for auditability.
- Successful generation replaces the previous generated question set for that submission and moves the submission to `challenge_ready`. Generation failures mark the submission `failed` with `processingError` while preserving existing stored questions until a later successful retry.

### Phase 12: Student Challenge Answer Flow

Deliverables:

- Student challenge question UI.
- Autosave or draft save for answers.
- Final answer submission.
- Status transition to `ready_for_grading`.

Acceptance:

- Students cannot finalize until required questions are answered.
- Once finalized, ZIP and answers are read-only for that attempt.
- Finalization marks the plugin submission ready for grading and creates/submits the core attempt for summative assignments.

Progress:

- The assigned-group student submission route now runs final ZIP validation, submitted-function analysis, and challenge question generation in sequence for valid archives. The response includes only student-safe question fields; nearest examples, prompt metadata, raw model output, and generation provenance remain server-side/teacher-only.
- Automatic student-path generation uses a course teacher/owner's configured non-local question-authoring AI connection through a core helper, so students do not need personal AI preferences and provider keys stay server-side.
- Added `coding-homework-grader/challenge-answers` with `PUT` for draft answer saves and `POST` for final answer submission. Finalization requires every generated question to have a non-empty answer.
- The student UI now shows generated challenge questions immediately after a valid ZIP submission, locks the ZIP upload once questions are ready, allows draft saves, and marks the submission complete when final answers are submitted.
- Final answer submission updates the plugin submission status to `ready_for_grading` and records the core gradebook attempt/submission for summative assigned activities.

### Phase 13: Teacher Manual Grading And Gradebook Integration

Deliverables:

- Manual grading renderer. Complete: `coding-homework-grader-manual-grading`.
- Gradebook attempts route. Complete: `coding-homework-grader/gradebook-attempts`.
- Teacher review UI with code/question/answer/source context. Complete in the detailed gradebook overlay and basic bulk manual grading page.
- Core grade recording. Complete through final-answer core attempts plus existing gradebook override saves.
- Released grade visibility through existing gradebook. Complete through normal gradebook release behavior.

Acceptance:

- Teachers can review ready submissions.
- Teachers can assign scores and feedback.
- Grades appear in course/group gradebook summaries.

### Phase 14: Operational Hardening

Deliverables:

- Background job model or resumable processing service for long extraction/embedding/generation tasks.
- Idempotency keys for retries.
- Processing status timeline.
- Logging and error categorization.
- Rate limiting and file size limits.

Acceptance:

- Failed processing can be retried without duplicate attempts/questions.
- Long-running processing does not block normal page requests.

### Phase 15: Production Object Storage

Deliverables:

- Introduce a platform storage abstraction for plugin artifacts.
- Move assignment PDFs, student ZIP files, extracted source files, generated artifacts, and review downloads from local disk to configurable object storage.
- Store object keys, checksums, content type, size, and retention metadata in plugin-owned attachment rows.
- Add signed, permission-checked download routes rather than exposing object URLs directly.
- Add lifecycle/retention policies for submitted homework artifacts and extracted temporary files.
- Keep local filesystem storage as the development adapter.

Acceptance:

- The plugin can run with local storage in development and object storage in production using the same service interface.
- Student submissions and teacher downloads continue to pass through Cognelo authorization checks.
- Reprocessing can retrieve historical artifacts from object storage by stable object key.

### Phase 16: Cross-Course Vector Retrieval And Reuse

Deliverables:

- Extend the shared vector/content-plugin interfaces for course-, subject-, and cross-course retrieval once single-course retrieval is stable.
- Keep reusable content chunks, code snippets, AST representations, embeddings, metadata, and access scope in shared vector-service tables populated by owning content type plugins.
- Support course-, subject-, and activity-scoped retrieval, with strict authorization and visibility filters.
- Add invalidation/reindexing rules when content resources change.
- Preserve per-submission documentation snapshots by storing the retrieved chunk IDs and exact chunk text used at generation time.

Acceptance:

- The plugin can retrieve relevant prior examples from a shared course/subject index without importing concrete content type plugins.
- Retrieval respects course membership, group visibility, hidden content, and the assignment's prior-content cutoff.
- Existing generated questions remain reproducible from stored snapshot data even after the global index changes.

### Phase 17: Quality, Research, And Analytics

Deliverables:

- Store research metadata for selected candidates, distances, model versions, and answer completion.
- Exportable teacher/research CSV or JSON.
- Optional teacher ratings of generated questions for relevance, clarity, and depth.
- Dashboard summaries for missing, ready, graded, and failed submissions.

Acceptance:

- The plugin can reproduce the paper's core evaluation fields.
- Teachers can identify why a question was asked.

### Phase 18: Documentation And Rollout

Deliverables:

- Plugin README.
- Plugin `PROJECT_MEMORY.md`, following the same rule as every Cognelo plugin, kept up to date with plugin-specific behavior, implementation state, constraints, data ownership, route contracts, storage/indexing decisions, and design choices.
- Plugin authoring handbook update.
- Root `README.md` update for setup, feature overview, and any new storage/indexing requirements.
- `docs/PROJECT_MEMORY.md` update for platform-level integration points and long-term decisions.
- Seed/demo activity if useful.

Acceptance:

- A new developer can understand how to author, assign, submit, and grade a Coding Homework Grader activity.
- The root README and project memory accurately reflect the implemented behavior and operational requirements.
- The plugin memory follows the existing plugin convention and captures all relevant plugin-local decisions without scattering plugin-specific notes into platform memory.
- The plugin's current limitations are documented.

## Test Plan

Unit tests:

- manifest and registry tests
- config schema tests
- submission requirement schema tests
- assignment persistence tests
- bank-to-course copy tests
- content snapshot tests
- parser/AST serializer tests
- structure validation tests for required files, folders, and functions
- embedding distance tests
- candidate selection tests
- prompt builder tests
- ZIP validation tests
- storage adapter tests
- global index retrieval and authorization filter tests

Route tests:

- assignment save/load
- PDF upload/delete
- requirements import/save
- documentation preview
- preflight upload/check
- ZIP submission
- question generation retry
- answer finalization
- gradebook attempts

Integration tests:

- activate/deactivate plugin-owned tables
- create bank activity, assign to course, verify independent course-owned plugin data
- summative student submission creates a core attempt only after final answers
- manual grade records normalized grade
- object storage-backed artifacts remain downloadable through authorized plugin routes
- shared-index retrieval respects content visibility and assignment cutoff rules

Frontend checks:

- authoring form dirty state uses shared unsaved-change guard
- student flow state transitions
- teacher grading panel renders submission context

## Security And Privacy Notes

- Reject ZIP path traversal, symlinks, excessive file counts, excessive uncompressed size, and unsupported file types.
- Apply the same archive safety checks to temporary preflight uploads.
- Expire and delete preflight artifacts because they are not submitted work.
- Store original submissions for teacher review, but do not expose them to other students.
- Do not show retrieved prior examples to students.
- Do not expose AI prompts containing other course materials to students.
- Keep provider keys server-side.
- Treat generated questions as assessment artifacts tied to a specific attempt.
- Avoid letting a student see challenge questions, revise the ZIP, and resubmit in the same attempt.

## Open Decisions

- Whether final submission should occur at ZIP upload or after challenge answers. Recommended: after challenge answers.
- Whether a student may create a new attempt after seeing challenge questions. Recommended: yes only if the assignment attempt policy allows another attempt, and the next attempt gets a newly generated challenge set.
- Whether group-specific content before the assignment should be included in the documentation snapshot. Recommended: defer to a later phase.
- Whether PDF assignment statements should also be indexed as documentation. Recommended: no; the assignment statement describes the task, while prior content resources define the taught material.
- Which object storage backend should be the first production target. Recommended: design for S3-compatible APIs while keeping a local adapter for development.
- Whether to introduce `pgvector` before cross-course retrieval. Recommended: yes, as the shared Postgres-backed vector capability used by content plugins and activity plugins during development and early production.
- Whether the vector retrieval service should be platform-wide or packaged as a separate indexing package/app. Recommended: start as a shared platform service with content-plugin extraction/chunking boundaries, then split operationally only if scale requires it.
- Embedding model and vector dimensions for pgvector. Pending discussion; do not hardcode a production dimension until the first embedding provider/model is selected.
- Shared table design for multiple dimensions/model versions. Pending discussion; likely either model/dimension-specific tables or partitioning by `modelKey`/`dimensions`.
- Whether submitted homework functions should use the same common vector tables as course content or separate assessment-scoped tables with the same service contract.
- Whether generated challenge answers should eventually be auto-graded. Recommended: treat answer assessment as advisory until validated.
- Which submission requirement format teachers can upload first. Recommended: start with JSON plus a structured UI, then add CSV/YAML later if teachers need it.
