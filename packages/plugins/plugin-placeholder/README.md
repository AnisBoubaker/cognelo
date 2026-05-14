# Plugin: Placeholder

This README is for the placeholder plugin only.

The placeholder plugin exists as a minimal activity shell while a real pedagogical activity is still being designed.

## Purpose

`@cognelo/plugin-placeholder` provides:

- a lightweight registered activity type
- localized labels
- a minimal plugin boundary example

## Activity Type

- `placeholder`

## Current State

This plugin intentionally relies only on core bank/course activity records for real activity behavior.

It also declares two dummy plugin-owned tables, `PluginPlaceholderDummyRecord` and `PluginPlaceholderDummyAudit`, so the platform plugin activation/deactivation backup and restore flow can be tested with a low-risk plugin. Those tables live in this plugin's local Prisma schema and migration manifest.

If this placeholder ever grows custom authoring or settings UI, that form should register with `useUnsavedChangesGuard` from `@cognelo/activity-ui`.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-placeholder/README.md`
- `packages/plugins/plugin-placeholder/PROJECT_MEMORY.md`
