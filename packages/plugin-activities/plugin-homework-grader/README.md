# Plugin: Homework Grader

This README is for the homework-grader plugin only.

The package currently defines the activity shell, localized metadata, and config schema for a future homework grading workflow.

## Purpose

`@cognelo/plugin-homework-grader` is the planned home for programming-assignment submission and grading behavior.

Current scope:

- plugin definition
- localized labels
- initial config schema
- server plugin placeholder

## Activity Type

- `homework-grader`

Current config shape:

- `gradingMode`
- `maxAttempts`
- optional `repositoryTemplateUrl`

## Current State

This plugin is still a scaffold. It does not yet own dedicated persistence tables, bank-to-course copy hooks, or activity-specific UX beyond registration metadata.

When this plugin gains teacher authoring or settings UI, the first form implementation should register with `useUnsavedChangesGuard` from `@cognelo/activity-ui` so navigation uses the platform-wide unsaved-change dialog.

## Phase 0 Direction

The next product form of this plugin is **Coding Homework Grader**. The implementation plan lives in:

- `docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md`

Phase 0 keeps the package as the existing scaffold but captures stable service contracts for the future implementation in `src/algorithm.ts`.

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

- `packages/plugin-activities/plugin-homework-grader/README.md`
- `packages/plugin-activities/plugin-homework-grader/PROJECT_MEMORY.md`
