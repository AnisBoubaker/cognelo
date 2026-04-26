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

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-homework-grader/README.md`
- `packages/plugins/plugin-homework-grader/PROJECT_MEMORY.md`
