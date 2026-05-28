# Coding Homework Grader Implementation Plan

This plan describes the phased implementation of the new Coding Homework Grader activity plugin.

The existing `plugin-homework-grader` package is currently only a scaffold. The product direction is to rename it to Coding Homework Grader and turn it into a full programming-homework submission workflow:

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
- the existing scaffold under `packages/plugin-activities/plugin-homework-grader`
- the current activity plugin, content type plugin, content tree, and gradebook architecture

The Python prototype maps to these future TypeScript modules:

- `0_data_cleanup.py` -> source normalization and comment stripping
- `1_parse_code.py` -> code parsing, AST serialization, and function extraction
- `2_generate_corpus_embeddings.py` -> reference corpus indexing
- `3_compute_similarities.py` -> submission/reference similarity search
- `4_select_candidates.py` -> divergent function candidate selection
- `5_generate_questions.py` -> RAG-backed challenge question generation

The implementation must be TypeScript/Node/Postgres-native. The Python prototype is only a behavioral reference.

## Product Boundaries

### In Scope

- A real activity plugin named Coding Homework Grader.
- Teacher authoring for assignment text and assignment PDF.
- Student ZIP upload.
- Server-side ZIP validation and extraction.
- C-first code analysis using a TypeScript/Node parser pipeline.
- Course documentation snapshot from prior content resources.
- AST serialization and embedding.
- Retrieval of closest prior examples.
- Divergent candidate selection.
- LLM-generated challenge questions.
- Student answers to generated challenge questions.
- Teacher review and manual grading.
- Core gradebook integration for summative submissions.

### Out Of Scope For The First Complete Version

- Fully automatic grading of challenge answers.
- Full plagiarism adjudication.
- Multi-language parser parity beyond the first C implementation.
- Long-term production object storage.
- A global cross-course embeddings service.
- Real-time student code execution.
- Direct reuse of the Python prototype in production.

## Key Architecture Principles

- Keep plugin behavior isolated in `packages/plugin-activities/plugin-coding-homework-grader`.
- Keep plugin-owned persistence in plugin-owned tables and migration manifests.
- Do not add Coding Homework Grader columns to core course, activity, content, attempt, or grade tables.
- Use core only for generic course/activity/assignment/content/gradebook orchestration.
- Use content type plugin embedding descriptors through core services rather than importing concrete content type plugins.
- Store historical snapshots for assignment documentation and generated questions so later content edits do not mutate an existing submission record.
- Use existing AI agent connection patterns for server-side generation; never expose provider keys to the browser.
- Register every authoring/settings form with `useUnsavedChangesGuard`.

## Naming And Rename Strategy

Rename the user-facing activity from Homework grader to Coding Homework Grader.

Recommended package/API rename:

- Package directory: `packages/plugin-activities/plugin-coding-homework-grader`
- Package name: `@cognelo/plugin-coding-homework-grader`
- Plugin key: `coding-homework-grader`
- Activity type key: `coding-homework-grader`
- Database namespace: `plugin_coding_homework_grader`

Because the current homework grader is a scaffold with no plugin-owned production data, this can be treated as a clean rename during development. If local scaffold records exist, add a small migration/seed cleanup note rather than a full compatibility layer.

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

`PluginCodingHomeworkAttachment`

- `id`
- `ownerKind`: course activity, bank activity, or submission
- `ownerId`
- `kind`: assignment PDF, submission ZIP, extracted source, extracted non-source
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
- `embedding` JSON number array for the MVP
- `metadata` JSON
- timestamps

For MVP scale, embeddings can be stored as JSON arrays and compared in Node. Keep the vector search behind an interface so a future phase can swap in `pgvector` or a managed vector database without changing plugin workflows.

### Submission And Challenge Tables

`PluginCodingHomeworkSubmission`

- `id`
- `activityId`
- `groupId`
- `userId`
- `coreAttemptId` optional
- `documentationSnapshotId`
- `zipAttachmentId`
- `status`: uploaded, processing, challenge_ready, answered, ready_for_grading, graded, failed
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
- `embedding` JSON number array
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

1. Build a reference corpus from prior course content.
   - Resolve each prior content resource through core's content embedding source descriptor.
   - Extract text from Markdown/text resources directly.
   - Extract text from PDFs and supported uploaded files server-side.
   - Extract code blocks and source files.
   - Parse supported language source into functions.
   - Serialize each function AST into normalized text.
   - Embed each AST.
   - Store reference functions and embeddings in the snapshot.

2. Process a student submission.
   - Validate ZIP size, file count, path safety, and allowed extensions.
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
- No submission: show homework statement and upload ZIP.
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

- For summative assignments, create a core attempt when the student uploads the ZIP or when the challenge set is finalized.
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
- Update tests that currently expect `homework-grader`.

Acceptance:

- The picker shows Coding Homework Grader under Programming.
- The old no-op scaffold test is replaced with a renamed manifest test.
- Typecheck passes.

### Phase 2: Plugin-Owned Persistence Foundation

Deliverables:

- Add plugin Prisma schema and generated client.
- Add plugin database module with activation migrations.
- Add assignment, attachment, snapshot, reference function, submission, submission file, submission function, question, and review tables.
- Add backup/deactivation coverage through existing plugin lifecycle.

Acceptance:

- Plugin activation creates all tables.
- Plugin deactivation backs them up.
- `npm run db:migrate:all` succeeds.

### Phase 3: Teacher Assignment Authoring

Deliverables:

- Teacher authoring renderer.
- Markdown assignment text editing.
- Assignment PDF upload route.
- Assignment preview.
- Bank-to-course copy hook for authored prompt/PDF/settings.

Acceptance:

- Teachers can author an activity in an activity bank.
- Adding from a bank copies assignment settings into course-owned plugin rows.
- Course-local edits do not mutate bank-owned rows.

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

### Phase 5: Text And Code Extraction From Course Materials

Deliverables:

- Use core content embedding source descriptors.
- Extract Markdown/text content.
- Extract uploaded PDF text.
- Extract source files and fenced code blocks where possible.
- Store extraction diagnostics.

Acceptance:

- Text, file, and PDF resources can contribute to the reference corpus.
- Unsupported resources are reported but do not crash snapshot creation.

### Phase 6: C Parser And AST Serializer

Deliverables:

- Parser adapter interface.
- C adapter.
- Function extraction.
- Stable AST text serialization.
- Parse diagnostics and tests with real C fixtures.

Acceptance:

- Known C fixture functions produce deterministic AST strings.
- Parse failures are explicit and recoverable.

### Phase 7: Reference Embedding Index

Deliverables:

- Embedding provider wrapper using server-side AI model settings.
- Reference function embedding storage.
- Vector index abstraction over JSONB-stored arrays for MVP.
- Cosine distance implementation and tests.

Acceptance:

- Reference functions can be embedded and searched.
- Distance ranking is deterministic in tests with fixture vectors.

### Phase 8: Student ZIP Submission

Deliverables:

- Student upload UI.
- ZIP upload route.
- Size, file count, file extension, MIME, and path traversal validation.
- Safe extraction to local storage.
- Submission status records.

Acceptance:

- Students can upload a ZIP.
- Unsafe archives are rejected.
- Valid archives create plugin submission records and extracted file metadata.

### Phase 9: Submission Analysis And Candidate Selection

Deliverables:

- Parse submitted source files.
- Embed submitted functions.
- Compare to reference functions.
- Store nearest examples and divergence scores.
- Select top candidate functions.

Acceptance:

- Given fixtures, the service selects structurally divergent functions.
- Candidate selection is inspectable by teachers.

### Phase 10: Challenge Question Generation

Deliverables:

- Prompt builder based on the research prompt.
- Model call through server-side AI connection.
- Question storage with prompt version and retrieved examples.
- Retry/reprocess route for failures.

Acceptance:

- Each selected function receives one generated free-response question.
- Students do not see prior examples used for generation.
- Teachers can audit question provenance.

### Phase 11: Student Challenge Answer Flow

Deliverables:

- Student challenge question UI.
- Autosave or draft save for answers.
- Final answer submission.
- Status transition to `ready_for_grading`.

Acceptance:

- Students cannot finalize until required questions are answered.
- Once finalized, ZIP and answers are read-only for that attempt.
- Summative finalization creates/submits the core attempt.

### Phase 12: Teacher Manual Grading And Gradebook Integration

Deliverables:

- Manual grading renderer.
- Gradebook attempts route.
- Teacher review UI with code/question/answer/source context.
- Core grade recording.
- Released grade visibility through existing gradebook.

Acceptance:

- Teachers can review ready submissions.
- Teachers can assign scores and feedback.
- Grades appear in course/group gradebook summaries.

### Phase 13: Operational Hardening

Deliverables:

- Background job model or resumable processing service for long extraction/embedding/generation tasks.
- Idempotency keys for retries.
- Processing status timeline.
- Logging and error categorization.
- Rate limiting and file size limits.

Acceptance:

- Failed processing can be retried without duplicate attempts/questions.
- Long-running processing does not block normal page requests.

### Phase 14: Quality, Research, And Analytics

Deliverables:

- Store research metadata for selected candidates, distances, model versions, and answer completion.
- Exportable teacher/research CSV or JSON.
- Optional teacher ratings of generated questions for relevance, clarity, and depth.
- Dashboard summaries for missing, ready, graded, and failed submissions.

Acceptance:

- The plugin can reproduce the paper's core evaluation fields.
- Teachers can identify why a question was asked.

### Phase 15: Documentation And Rollout

Deliverables:

- Plugin README.
- Plugin memory.
- Plugin authoring handbook update.
- Project memory update for platform-level integration points.
- Seed/demo activity if useful.

Acceptance:

- A new developer can understand how to author, assign, submit, and grade a Coding Homework Grader activity.
- The plugin's current limitations are documented.

## Test Plan

Unit tests:

- manifest and registry tests
- config schema tests
- assignment persistence tests
- bank-to-course copy tests
- content snapshot tests
- parser/AST serializer tests
- embedding distance tests
- candidate selection tests
- prompt builder tests
- ZIP validation tests

Route tests:

- assignment save/load
- PDF upload/delete
- documentation preview
- ZIP submission
- question generation retry
- answer finalization
- gradebook attempts

Integration tests:

- activate/deactivate plugin-owned tables
- create bank activity, assign to course, verify independent course-owned plugin data
- summative student submission creates a core attempt only after final answers
- manual grade records normalized grade

Frontend checks:

- authoring form dirty state uses shared unsaved-change guard
- student flow state transitions
- teacher grading panel renders submission context

## Security And Privacy Notes

- Reject ZIP path traversal, symlinks, excessive file counts, excessive uncompressed size, and unsupported file types.
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
- Whether to introduce `pgvector` now. Recommended: no for MVP; hide JSONB vector storage behind an interface.
- Whether generated challenge answers should eventually be auto-graded. Recommended: treat answer assessment as advisory until validated.

