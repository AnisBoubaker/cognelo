# Plugin: Coding Homework Grader

This README is for the coding-homework-grader plugin only.

The package currently defines the activity shell, localized metadata, initial algorithm contracts, and config schema for a future coding homework grading workflow.

## Purpose

`@cognelo/plugin-coding-homework-grader` is the planned home for programming-assignment submission and grading behavior.

Current scope:

- plugin definition
- localized labels
- initial config schema
- server plugin placeholder

## Activity Type

- `coding-homework-grader`

Current config shape:

- `gradingMode`
- `maxAttempts`
- optional `repositoryTemplateUrl`

## Current State

This plugin is still a scaffold. It is registered as `coding-homework-grader`, uses the package `@cognelo/plugin-coding-homework-grader`, and does not yet own dedicated persistence tables, bank-to-course copy hooks, or activity-specific UX beyond registration metadata.

When this plugin gains teacher authoring or settings UI, the first form implementation should register with `useUnsavedChangesGuard` from `@cognelo/activity-ui` so navigation uses the platform-wide unsaved-change dialog.

## Implementation Direction

The phased implementation plan lives in:

- `docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md`

Phase 0 captured stable service contracts for the future implementation in `src/algorithm.ts`. Phase 1 renamed the package, plugin key, activity key, and localized picker metadata to Coding Homework Grader.

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
