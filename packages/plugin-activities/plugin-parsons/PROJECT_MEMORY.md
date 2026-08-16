# Parsons Plugin Memory

This file is for Parsons-specific memory only.

## Long-Term Decisions

- Shared code editor and syntax renderer come from `@cognelo/activity-ui`.

## Current Feature Decisions

- Teachers author the reference solution in a syntax-colored editor with line numbers.
- Teacher authoring forms use the shared unsaved-change guard from `@cognelo/activity-ui`; future Parsons authoring/settings panels should register with `useUnsavedChangesGuard`.
- Teachers create groups from editor-adjacent line selection rather than from a separate line-to-group assignment form.
- Groups are stored as line ranges, not per-line selections.
- Teachers can mark a group as strict or flexible internally.
- Teachers can add precedence rules between groups.
- Scrambling is generated from the reference solution and should be random on each fresh try/reset.
- Students can click a line to activate it and then use arrow keys to move it; left/right adjust indentation when indentation mode is enabled.
- Order feedback should count minimally misplaced units rather than every downstream displaced line.
- Parsons AI generation uses the platform knowledge modes. All modes provide the complete subject catalog as a curriculum boundary; selected skills additionally steer generation, suggestion maps the generated prompt and solution to exact subject skills in the unsaved host draft, and ignore neither reads nor changes that draft and performs no mapping pass.

## Persistence Decisions

- Parsons authoring uses generic activity fields/config for course/bank synchronization. Core performs the copy and permanently locks synchronization once any attempt exists; attempt/event rows are never synchronized.
- Core's bank-version diff covers complete Parsons authoring because it is stored in immutable generic config; plugin-owned attempt history is not authoring data and is never compared.
- Parsons bank config versions are publication milestones: draft saves do not create versions, while changed Published saves do.

- Standalone gradebook **Review all** uses the latest completed attempt per participant, displays the authored solution, and derives hoverable misplaced-block and grade distributions without exposing student answers individually.

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
  - `submit`
- Teacher/admin previews remain ephemeral on purpose so they do not pollute analytics or research data.
- Parsons exposes a teacher-only gradebook attempts route at `parsons/gradebook-attempts` through assigned group activity dispatch. It returns completed submissions by default and includes in-progress/abandoned attempts plus event history when `includeAttempts=true`, supporting the course gradebook "See answer" overlay.
- Parsons registers a server `gradeAttempt` handler and is the first plugin used by the gradebook automatic regrade API. Regrading uses the stored plugin attempt reference, evaluates the submitted attempt state against the current course-local activity config, and lets core write the normalized grade plus `regraded` audit event.
- Summative Parsons submissions suppress correctness feedback during the activity, but released grades include sanitized deterministic feedback in the normalized grade result. The student-facing feedback reuses the formative order/indentation messages and includes order/indentation raw-score components so students can see why points were lost without seeing raw plugin payloads or attempt history.

## Research/Product Intent

The plugin is being built to support:

- Teacher authoring uses the shared responsive `EditActionBar`, driven by the same draft snapshot as `useUnsavedChangesGuard`.

- teacher-facing flags when students may be lost
- research on student behavior
- future analytics over resets, checks, ordering mistakes, and time-on-task patterns

## Verification Habits

- `npm run typecheck`
- `npm run build`
- `npm run db:migrate:all` after schema changes touching Parsons persistence
