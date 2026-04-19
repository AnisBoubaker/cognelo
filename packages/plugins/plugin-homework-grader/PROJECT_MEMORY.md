# Homework Grader Plugin Memory

This file is for homework-grader-specific memory only.

## Current Decisions

- The plugin is intentionally still a scaffold.
- Plugin-specific grading/submission logic should stay inside this package as it grows.
- If the plugin later needs persistence, those tables should live under the homework-grader plugin namespace rather than altering core activity tables for grading-specific concerns.
- Plugin-specific server handlers should live here and be mounted through the generic plugin dispatcher.

## Documentation Rule

If a change affects only the homework-grader plugin, update this file and the local plugin README instead of the root project docs.
