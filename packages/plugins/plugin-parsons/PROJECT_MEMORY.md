# Parsons Plugin Memory

This file is for Parsons-specific memory only.

## Long-Term Decisions

- Parsons-specific logic stays inside `packages/plugins/plugin-parsons`.
- Parsons-specific persistence lives in plugin-owned tables, not in core activity tables.
- Parsons-specific server handlers live in plugin-owned route definitions, not in `apps/api`.
- Shared code editor and syntax renderer come from `@cognara/activity-ui`.

## Current Feature Decisions

- Teachers author the reference solution in a syntax-colored editor with line numbers.
- Teachers create groups from editor-adjacent line selection rather than from a separate line-to-group assignment form.
- Groups are stored as line ranges, not per-line selections.
- Teachers can mark a group as strict or flexible internally.
- Teachers can add precedence rules between groups.
- Scrambling is generated from the reference solution and should be random on each fresh try/reset.
- Students can click a line to activate it and then use arrow keys to move it; left/right adjust indentation when indentation mode is enabled.
- Order feedback should count minimally misplaced units rather than every downstream displaced line.

## Persistence Decisions

- Parsons attempts are stored in:
  - `PluginParsonsAttempt`
  - `PluginParsonsAttemptEvent`
- Attempt state stores:
  - latest block order
  - latest indentation state
  - selected block
  - last evaluation snapshot
- Attempt events currently record:
  - `move`
  - `indent`
  - `reset`
  - `check`
- Teacher/admin previews remain ephemeral on purpose so they do not pollute analytics or research data.

## Research/Product Intent

The plugin is being built to support:

- teacher-facing flags when students may be lost
- research on student behavior
- future analytics over resets, checks, ordering mistakes, and time-on-task patterns

## Verification Habits

- `npm run typecheck`
- `npm run build`
- `npm run db:generate` after schema changes touching Parsons persistence

## Documentation Rule

If a change affects only Parsons, update this file and the local plugin README instead of pushing those details into the root project docs.
