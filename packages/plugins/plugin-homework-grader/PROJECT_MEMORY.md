# Homework Grader Plugin Memory

This file is for homework-grader-specific memory only.

## Current Decisions

- The plugin is intentionally still a scaffold.
- It has no web authoring view yet, so there is currently no form surface to register with the shared unsaved-change guard.
- When real teacher authoring or settings UI is added, register every form with `useUnsavedChangesGuard` before considering the UI complete.
- It currently has no plugin-owned persistence or bank-to-course copy hook; add those only when real grading/reference data exists.
