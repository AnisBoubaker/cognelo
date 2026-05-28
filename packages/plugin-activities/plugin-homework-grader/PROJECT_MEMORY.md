# Homework Grader Plugin Memory

This file is for homework-grader-specific memory only.

## Current Decisions

- The plugin is intentionally still a scaffold.
- It has no web authoring view yet, so there is currently no form surface to register with the shared unsaved-change guard.
- When real teacher authoring or settings UI is added, register every form with `useUnsavedChangesGuard` before considering the UI complete.
- It currently has no plugin-owned persistence or bank-to-course copy hook; add those only when real grading/reference data exists.
- The planned product name is Coding Homework Grader. The package has not been renamed yet; that belongs to the next implementation phase.
- Phase 0 added `src/algorithm.ts` with stable TypeScript-facing contracts for source files, submission requirements, structure validation summaries, parser adapters, AST functions, embeddings, candidate selection, and challenge question generation.
- The first parser implementation should target C, but the contracts are intentionally language-neutral so future parser adapters can support additional languages.
- The research prototype in `tmp/challenge-questions/scripts` is reference material only. Production plugin code must not import, execute, or otherwise depend on files under `tmp`.
- The initial challenge question prompt version is `coding-homework-grader.challenge-question.v1`.
