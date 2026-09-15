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

Its linked course copies therefore use the platform's generic bank synchronization without a plugin hook. Core locks bank-to-course retrieval after any attempt, while course-to-bank publication remains available to users with bank-write permission.

Its immutable bank versions are also compared entirely by the shared core diff visualizer.

Draft saves create no version; a changed save explicitly marked Published creates the next immutable snapshot.

It also declares two dummy plugin-owned tables, `PluginPlaceholderDummyRecord` and `PluginPlaceholderDummyAudit`, so the platform plugin activation/deactivation backup and restore flow can be tested with a low-risk plugin. Those tables live in this plugin's local Prisma schema and migration manifest.

If this placeholder ever grows custom authoring or settings UI, that form should register with `useUnsavedChangesGuard` from `@cognelo/activity-ui`.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-activities/plugin-placeholder/README.md`
- `packages/plugin-activities/plugin-placeholder/PROJECT_MEMORY.md`
