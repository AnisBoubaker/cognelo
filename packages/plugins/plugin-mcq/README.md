# Plugin: MCQ

This README is for the MCQ plugin only.

## Purpose

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity type.

Teachers author MCQ content in an advanced editor using a Markdown-like grammar with task-list style answer markers.

Students see a rendered MCQ activity with single-choice or multi-choice controls inferred from the authored answer key.

## Authoring Model

The main MCQ source is written as text.

- `##` headings define questions
- `- [x]` defines a correct answer
- `- [ ]` defines an incorrect answer
- fenced code blocks are syntax-highlighted in the rendered student view

## Current State

The plugin currently relies on core activity records only and does not persist student submissions yet.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-mcq/README.md`
- `packages/plugins/plugin-mcq/PROJECT_MEMORY.md`
