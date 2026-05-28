# Coding Homework Grader Plugin Memory

This file is for coding-homework-grader-specific memory only.

## Current Decisions

- The plugin is intentionally still a scaffold.
- It has no web authoring view yet, so there is currently no form surface to register with the shared unsaved-change guard.
- When real teacher authoring or settings UI is added, register every form with `useUnsavedChangesGuard` before considering the UI complete.
- Phase 2 added plugin-owned Prisma schema, generated client, database manifest, and activation migration coverage for assignment, bank assignment, requirement set, bank requirement set, attachment, documentation snapshot, reference function, submission, submission file, submission function, challenge question, and review tables.
- The plugin still has no bank-to-course copy hook; add it in the teacher authoring phase once prompt/PDF/settings/requirements records are actually written.
- Phase 1 renamed the scaffold package to `@cognelo/plugin-coding-homework-grader`, the plugin and activity keys to `coding-homework-grader`, and the plugin database namespace to `plugin_coding_homework_grader`.
- The picker display name is Coding Homework Grader and the activity remains in the Programming category.
- Phase 0 added `src/algorithm.ts` with stable TypeScript-facing contracts for source files, submission requirements, structure validation summaries, parser adapters, AST functions, embeddings, candidate selection, and challenge question generation.
- The first parser implementation should target C, but the contracts are intentionally language-neutral so future parser adapters can support additional languages.
- The research prototype in `tmp/challenge-questions/scripts` is reference material only. Production plugin code must not import, execute, or otherwise depend on files under `tmp`.
- The initial challenge question prompt version is `coding-homework-grader.challenge-question.v1`.
- Requirements are modeled as separate course and bank requirement-set tables, not only as JSON embedded in assignments, so uploaded/imported structure requirements can evolve independently from prompt authoring.
