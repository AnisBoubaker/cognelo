# Plugin: Parsons

This README is for the Parsons plugin only.

It documents plugin-specific behavior, persistence, routes, and contributor workflow. Platform-wide architecture belongs in the root [README.md](../../../README.md).

## Purpose

`@cognelo/plugin-parsons` provides the `parsons-problem` activity type for programming education.

Teachers can:

- define the prompt
- author a reference solution
- choose the display language
- strip indentation from the student version
- create line groups directly from the editor gutter
- mark groups as strict or flexible
- add precedence rules between groups

Students can:

- reorder scrambled lines
- restore indentation when required
- use click-to-select plus arrow-key movement
- resume persisted attempts

## Package Contents

```text
src/
  attempt-types.ts          Shared Parsons attempt schemas/types
  attempts.ts               Persistence logic for Parsons attempts
  db.ts                     Plugin DB manifest
  index.ts                  Public plugin exports
  messages.ts               Plugin-local i18n strings
  parsons.ts                Runtime/config/parsing/evaluation helpers
  plugin.ts                 Activity plugin definition and config schema
  routes.ts                 Plugin-owned server subroutes
  server.ts                 Server plugin exports
  web/
    parsons-activity-view.tsx
                            Plugin-owned web UI
```

## Activity Type

- `parsons-problem`

The activity config currently includes:

- `prompt`
- `solution`
- `language`
- `stripIndentation`
- `groups`
- `precedenceRules`

## Persistence

Parsons owns plugin-specific persistence for student attempts.

Current plugin-owned tables:

- `PluginParsonsAttempt`
- `PluginParsonsAttemptEvent`

These tables are modeled in this plugin's local Prisma schema under `prisma/schema.prisma`; attempt services use the plugin-local Prisma client from `src/db-client.ts`.

Key behavior:

- students get a persisted in-progress attempt
- reload restores saved block order, indentation, selected block, and last evaluation snapshot
- correct completion closes the current attempt
- the next fresh try starts a new attempt
- teacher/admin previews stay ephemeral so instructor exploration does not pollute student-behavior data

## Routes

Parsons owns its own plugin subroute definitions in `src/routes.ts`.

Current subroutes:

```text
POST   /api/courses/:courseId/activities/:activityId/parsons/attempt
PATCH  /api/courses/:courseId/activities/:activityId/parsons/attempt
GET    /api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/parsons/gradebook-attempts
```

These are also available through group-scoped assigned activity dispatch for student work. They are mounted through the platform’s generic plugin dispatchers, not through Parsons-specific files in `apps/api`.

The gradebook attempts route is teacher-only. It returns a participant's completed Parsons submissions by default and can include in-progress/abandoned attempts plus event history with `includeAttempts=true`; the course gradebook detailed-results page uses it for the Parsons "See answer" overlay.

Parsons registers a server `gradeAttempt` handler for the platform gradebook regrade API. Teacher-triggered regrades resolve the stored plugin attempt reference, evaluate the submitted attempt state against the current course-local activity config, and let the core gradebook service record the updated grade plus a `regraded` audit event.

Summative submissions do not show correctness feedback during the activity. When the gradebook item is released, Parsons provides sanitized deterministic student feedback through the core normalized grade result: the same order/indentation messages used by formative checks plus an order/indentation grading breakdown. This does not expose raw plugin payloads, attempt history, or grading timestamps to students.

## UX Notes

- student rows render in a compact editor-like style
- syntax highlighting and line numbers come from shared `@cognelo/activity-ui`
- teacher authoring is registered with the shared `useUnsavedChangesGuard`; future Parsons authoring/settings forms should register the same dirty/save/discard behavior
- scrambling is random on each fresh try/reset
- order feedback counts minimally misplaced units instead of cascading false counts
- groups are stored as line ranges so edits inside a group keep the group coherent

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-activities/plugin-parsons/README.md`
- `packages/plugin-activities/plugin-parsons/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
