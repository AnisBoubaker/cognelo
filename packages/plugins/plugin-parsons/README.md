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
```

These are also available through group-scoped assigned activity dispatch for student work. They are mounted through the platform’s generic plugin dispatchers, not through Parsons-specific files in `apps/api`.

## UX Notes

- student rows render in a compact editor-like style
- syntax highlighting and line numbers come from shared `@cognelo/activity-ui`
- scrambling is random on each fresh try/reset
- order feedback counts minimally misplaced units instead of cascading false counts
- groups are stored as line ranges so edits inside a group keep the group coherent

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-parsons/README.md`
- `packages/plugins/plugin-parsons/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
