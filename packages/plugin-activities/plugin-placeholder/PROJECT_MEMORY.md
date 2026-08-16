# Placeholder Plugin Memory

This file is for placeholder-plugin memory only.

## Current Decisions

- The placeholder plugin should stay minimal.
- It is a reference example for the plugin boundary more than a feature-heavy activity.
- If it ever grows real behavior, that behavior should remain inside this package.
- If it ever grows custom authoring or settings forms, those forms must use the shared unsaved-change guard.
- It includes two dummy plugin-owned tables, `PluginPlaceholderDummyRecord` and `PluginPlaceholderDummyAudit`, only so platform plugin activation/deactivation backup and restore flows can be tested. They are modeled through the plugin-local Prisma schema/client rather than the core Prisma schema.
- It currently needs no real plugin-owned persistence or bank-to-course copy hook because generic bank/course activity config is enough.
- It also needs no explicit synchronization hook: core copies its generic authoring state and enforces the attempt lock and bank permissions.
- It needs no bank-version diff extension; the shared core visualizer covers its generic version snapshots.
