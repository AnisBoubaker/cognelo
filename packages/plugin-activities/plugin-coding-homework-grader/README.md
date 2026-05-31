# Plugin: Coding Homework Grader

This README is for the coding-homework-grader plugin only.

The package currently defines the activity shell, localized metadata, initial algorithm contracts, teacher authoring surface, prior-documentation snapshot/extraction behavior, first C parser adapter, ZIP preflight/final-submission validation, submitted-function candidate analysis, challenge question generation, student challenge answer collection, plugin-owned persistence schema, and config schema for a coding homework grading workflow.

## Purpose

`@cognelo/plugin-coding-homework-grader` is the planned home for programming-assignment submission and grading behavior.

Current scope:

- plugin definition
- localized labels
- initial config schema
- plugin-owned Prisma schema, generated client, and activation migration manifest
- teacher authoring routes and React renderer
- prior-documentation preview and snapshot routes for course activities
- prior-documentation extraction route that consumes generic content type plugin extracted documents
- language-neutral parser registry with a C adapter
- ZIP archive reader and structure validation service
- temporary preflight upload route and UI for students and teacher sample checks
- final student ZIP submission route and UI for assigned group activities
- submitted-function parsing, deterministic dev embeddings, nearest-example retrieval, divergence scoring, and candidate selection
- teacher-triggered challenge question generation and retry storage for analyzed submissions
- automatic student-path challenge generation plus draft/final challenge answer routes and UI
- bank-to-course copy hook for authored prompt/settings/requirements

## Activity Type

- `coding-homework-grader`

Current config shape:

- `gradingMode`
- `maxAttempts`
- optional `repositoryTemplateUrl`

## Current State

This plugin is still building toward full grading, but it now has teacher authoring, prior-documentation snapshot/extraction flows, the first C parser adapter, temporary ZIP preflight validation, final ZIP submission storage, submitted-function candidate analysis, challenge question generation, and student challenge answer submission. It is registered as `coding-homework-grader`, uses the package `@cognelo/plugin-coding-homework-grader`, and owns the persistence foundation for authoring, documentation snapshots, submissions, challenge questions, and review records. It does not yet expose core gradebook attempts or grading routes.

The teacher authoring form is registered with `useUnsavedChangesGuard` from `@cognelo/activity-ui` so navigation uses the platform-wide unsaved-change dialog.

## Seed Fixture

The root Prisma seed creates `Coding homework grader: INF-155 TP1 Labyrinthe` as a complete dev fixture in Programming 101 / Section A. It reads `tmp/INF155-A2023-TP1.pdf` with `pdftotext`, attaches a copied PDF to the activity when the local file exists, uses `tmp/FichiersFournis` to build starter-file documentation, and stores bank/course plugin authoring rows, required ZIP structure/functions, a ready group documentation snapshot, a summative group assignment, and a gradebook item. The course student-support AI setting points to `seed-ai-agent-student-support`, which uses OpenAI when `OPENAI_API_KEY` is present and otherwise falls back to local Ollama unless overridden with `SEED_AI_AGENT_*` environment variables before running `npm run db:seed`.

## Implementation Direction

The phased implementation plan lives in:

- `docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md`

Phase 0 captured stable service contracts for the future implementation in `src/algorithm.ts`. Phase 1 renamed the package, plugin key, activity key, and localized picker metadata to Coding Homework Grader.

Phase 2 added the plugin-owned Prisma schema, generated client, and activation migration manifest. The plugin tables are registered through `src/db.ts` so the existing plugin activation/deactivation flow can create, back up, and restore them.

Phase 3 added teacher authoring routes and UI. Teachers can edit assignment Markdown, upload an assignment PDF, edit/import structure requirements, preview the assignment text, and save bank-owned or course-owned plugin records. Assigning a bank activity to a course copies the bank assignment, requirement set, and safe attachment records into course-owned plugin rows so later bank edits and course edits diverge.

Phase 4 added prior-documentation preview and snapshot routes. Course activity authoring can show visible content resources that appear before the activity in the content tree and can write a `PluginCodingHomeworkDocumentationSnapshot` row with anchor metadata, included resource metadata, and a stable content-tree fingerprint. Activity bank authoring does not show this preview because banks have no course content tree.

Phase 5 added extraction from snapshot resources through the shared content type plugin server interface. The Coding Homework Grader calls core's generic content extraction dispatcher and stores extracted documents plus diagnostics in `PluginCodingHomeworkDocumentationSnapshot.metadata.extraction`; text/file/PDF/GitHub-specific extraction logic stays in the owning content type plugins.

Phase 6 added `src/parsers.ts` with the language-neutral parser registry and first C parser adapter. It extracts C function definitions, emits deterministic normalized AST text, records source lines and code, and returns recoverable diagnostics for broken or unsupported files.

Phase 7 added `src/zip.ts`, `src/validation.ts`, and `src/preflight.ts`. Students and teachers can upload a temporary ZIP for structure validation against teacher requirements; the service separates missing required items, unsupported files, parser diagnostics, ignored files, valid files, and valid functions. Preflight creates plugin-owned `PluginCodingHomeworkSubmission` rows with `kind = preflight` and temporary attachment metadata, but it does not create a core attempt, gradebook record, challenge questions, or a final submission.

Phase 8 should not create a Coding Homework Grader-only vector database. Content resources belong to content type plugins, so content plugins should own extraction/chunking and invalidation decisions behind the shared content type plugin server interface, while production vector persistence/search should move to shared platform pgvector tables. The Coding Homework Grader should request similarity over prior course content through core/content-plugin dispatchers and store only the audit metadata it needs for selected references, nearest examples, generated questions, and submissions.

Phase 8 added `src/reference-search.ts` and the `coding-homework-grader/reference-search` route. Reference search reads a documentation snapshot's included content resources, calls core's generic vector search dispatcher, and stores the latest search audit metadata on the snapshot. The plugin does not read or own prior-content vector tables.

Phase 9 added `src/submission.ts`, the `coding-homework-grader/assignment` route, and the `coding-homework-grader/submission` route. Assigned students can load the prompt, submit a final ZIP, receive structure validation feedback, and create durable final submission/file records. Valid submissions store a non-temporary ZIP attachment plus extracted file rows; invalid structure submissions are recorded but do not extract files or write the uploaded ZIP. Gradebook attempts and challenge questions remain later phases.

Phase 10 added `src/analysis.ts` and the `coding-homework-grader/submission-analysis` route. Valid final submissions now analyze extracted source files, parse submitted functions, store deterministic development embeddings, retrieve nearest prior examples through core/content-plugin vector search, compute divergence scores, and mark selected candidates for future challenge generation. Prior course-content vector search stays behind the shared content type plugin interface; submitted functions are plugin-owned assessment artifacts.

Phase 11 added `src/generation.ts` and the teacher-only `coding-homework-grader/challenge-generation` route. Teachers can trigger or retry challenge question generation for analyzed submissions using their server-side question-authoring AI agent connection. Generated questions are stored in `PluginCodingHomeworkChallengeQuestion` with prompt version, model, selected function provenance, nearest examples, prompt hash/text, raw response, and attempt count. Student-facing question/answer UI remains a later phase, and prior examples must not be exposed to students.

Phase 12 added automatic student-path challenge generation and `src/challenge-answers.ts`. Valid student ZIP submissions now analyze the submitted functions, generate the challenge set through the course's configured student-support AI connection, and return a student-safe question payload immediately. The `coding-homework-grader/challenge-answers` route saves draft answers with `PUT` and finalizes answers with `POST`; finalization requires every question to be answered and moves the plugin submission to `ready_for_grading`. Core gradebook attempt/submission integration remains a later grading phase.

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

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-activities/plugin-coding-homework-grader/README.md`
- `packages/plugin-activities/plugin-coding-homework-grader/PROJECT_MEMORY.md`
