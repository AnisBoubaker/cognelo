# Plugin: MCQ

This README is for the MCQ plugin only.

## Purpose

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity type.

Teachers author MCQ content in an advanced editor using a Markdown-like grammar with task-list style answer markers.

Students see a rendered MCQ activity with single-choice or multi-choice controls inferred from the authored answer key.

During authoring, the complete source editor and rendered preview appear side by side. The source remains one copyable text block so teachers can paste or save a full activity outside Cognelo.

## Authoring Model

The main MCQ source is written as text.

- `##` headings define questions
- `- [x]` defines a correct answer
- `- [ ]` defines an incorrect answer
- fenced code blocks are syntax-highlighted in the rendered student view
- choices can contain fenced code blocks, including code-only alternatives where the marker line is followed by the code block
- the activity option `randomizeChoices` can show choices in randomized order while keeping grading tied to stable choice IDs

## Current State

The plugin currently relies on core bank/course activity records only and does not persist student submissions yet. Assigning from an activity bank copies the generic MCQ config into the course activity; there is no plugin-owned private data to copy today.

When a teacher has selected an enabled question-authoring AI agent in global settings, the authoring UI can generate MCQ source from the activity description. If the source field already contains content, the UI asks for confirmation before replacing it. The server route keeps the agent key private, injects subject/default-language/syntax requirements into the prompt, validates the generated source with the MCQ parser, and retries correction up to three total model calls before returning an error.

The MCQ authoring UI must stay registered with `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Any new MCQ authoring option, generated-content panel, or settings form should participate in that same dirty/save/discard flow.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-activities/plugin-mcq/README.md`
- `packages/plugin-activities/plugin-mcq/PROJECT_MEMORY.md`
