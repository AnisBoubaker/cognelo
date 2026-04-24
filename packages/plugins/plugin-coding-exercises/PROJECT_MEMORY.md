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
- Coding exercises support three authoring modes: full program, full function definition, and template snippet insertion.
- Non-student-visible composition pieces such as hidden support code and the hidden template scaffold are stored in plugin-owned private data and assembled server-side before Judge0 execution.
- Template-mode authoring uses a single hidden scaffold editor with a `{{ STUDENT_CODE }}` insertion marker; older prefix/suffix data should remain readable for backward compatibility.
- Template-mode teachers mark student-visible scaffold lines directly in the editor gutter; non-visible blocks collapse into a single language-appropriate hidden-code placeholder in the student-safe scaffold.
- The browser-facing `Activity.config` carries only the student-safe projected template scaffold, never the full hidden template source.
- Both visible sample tests and hidden tests can append language-specific harness code after the student submission so function-style and scaffolded exercises work across Python, C, C++, JavaScript, and similar runtimes.
- Teacher test authoring uses collapsible sample-test and hidden-test cards with saved validation status and per-test failure details.
- The same coding-exercise activity UI should work in both course-scoped teacher pages and group-scoped student assigned-activity pages by swapping the API client boundary rather than forking the plugin UI.
- Group-scoped student coding-exercise access uses assigned-activity routes under `groups/:groupId/activities/assigned/:activityId/...` to avoid route conflicts with teacher assignment-management endpoints.
- Student coding uses the shared Monaco editor from `@cognelo/activity-ui`, while teacher authoring still uses the in-house editor for the lighter authoring workflow.
- Plugin-owned user-facing translations should live inside the plugin package rather than in the host app's global i18n file.
