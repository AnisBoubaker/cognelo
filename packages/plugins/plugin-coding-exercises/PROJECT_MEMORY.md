# Coding Exercises Plugin Memory

This file is for coding-exercises-specific memory only.

## Long-Term Plugin Decisions

- Use Judge0 as a remote execution backend instead of running untrusted student code inside the Cognelo API app.
- Keep Judge0 behind Cognelo server routes; never expose Judge0 credentials or direct Judge0 browser calls.
- Treat `Activity.config` as student-visible and keep hidden tests plus grading internals out of it.
- In development, run Judge0 locally with Docker Compose.
- In production, point Cognelo to a separately hosted Judge0 server through environment configuration.
- Hidden tests live in `PluginCodingExerciseHiddenTest`.
- Teacher reference solutions live in `PluginCodingExerciseReferenceSolution`.
- Practice runs and later submissions live in `PluginCodingExerciseExecution`.
- The first execution route is `coding-exercises/run`, which stores each run server-side before and after the Judge0 request.
- Hidden tests are managed through the teacher-only `coding-exercises/hidden-tests` route.
- Enabled hidden tests must validate against the private reference solution before they are saved.
- Graded submissions are handled separately from sample runs through `coding-exercises/submit`.
- Teacher authoring separates student-facing starter code from a private reference solution; the reference solution must never be stored in public activity config.
- Teacher test authoring uses collapsible sample-test and hidden-test cards with saved validation status and per-test failure details.
- The same coding-exercise activity UI should work in both course-scoped teacher pages and group-scoped student assigned-activity pages by swapping the API client boundary rather than forking the plugin UI.
- Group-scoped student coding-exercise access uses assigned-activity routes under `groups/:groupId/activities/assigned/:activityId/...` to avoid route conflicts with teacher assignment-management endpoints.
- Plugin-owned user-facing translations should live inside the plugin package rather than in the host app's global i18n file.
