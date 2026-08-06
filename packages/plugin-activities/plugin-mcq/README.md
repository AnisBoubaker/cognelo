# Plugin: MCQ

This README is for the MCQ plugin only.

## Purpose

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity type.

Teachers author MCQ content in an advanced editor using a Markdown-like grammar with task-list style answer markers.

Students see the activity description as a student prompt before a rendered MCQ activity with single-choice or multi-choice controls inferred from the authored answer key.

During authoring, the complete source editor and rendered preview appear side by side. The source remains one copyable text block so teachers can paste or save a full activity outside Cognelo.

The student prompt uses the shared Markdown-backed `RichTextEditor` from `@cognelo/activity-ui`. Teachers can edit visually or switch to the always-available Markdown source mode; the stored activity description remains Markdown.

## Authoring Model

The main MCQ source is written as text.

- `##` headings define questions
- `- [x]` defines a correct answer
- `- [ ]` defines an incorrect answer
- fenced code blocks are syntax-highlighted in the rendered student view
- choices can contain fenced code blocks, including code-only alternatives where the marker line is followed by the code block
- the activity option `randomizeChoices` can show choices in randomized order while keeping grading tied to stable choice IDs

## Current State

The plugin stores authored content in generic bank/course activity config and owns no private plugin tables. Assigning from an activity bank therefore uses the platform's generic config copy. Summative student submissions are persisted as core `ActivityAttempt` records and graded through the shared gradebook workflow; formative checks remain client-side.

When a teacher has selected an enabled question-authoring AI agent in global settings, the authoring UI exposes a collapsed "Generate questions with AI" section. Teachers can provide private model instructions and choose the number of questions to generate. Generation uses both those instructions and the student prompt, but only the student prompt is rendered to learners. If the source field already contains content, the UI asks for confirmation before replacing it. The server route keeps the agent key private, injects subject/default-language/syntax requirements into the prompt, validates the generated source and requested question count with the MCQ parser, and retries correction up to three total model calls before returning an error.

The default code-language choice is `none`, shown as "Not a programming exercise." Teachers can select a programming language when unlabelled fenced code blocks need syntax highlighting.

The MCQ authoring UI must stay registered with `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Any new MCQ authoring option, generated-content panel, or settings form should participate in that same dirty/save/discard flow.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-activities/plugin-mcq/README.md`
- `packages/plugin-activities/plugin-mcq/PROJECT_MEMORY.md`
