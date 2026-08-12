# Coding Exercises Plugin Memory

This file is for coding-exercises-specific memory only.

## Long-Term Plugin Decisions

- Use Judge0 as a remote execution backend instead of running untrusted student code inside the Cognelo API app.
- Keep Judge0 behind Cognelo server routes; never expose Judge0 credentials or direct Judge0 browser calls.
- Treat `Activity.config` as student-visible and keep hidden tests plus grading internals out of it.
- In development, run Judge0 locally with Docker Compose. The default image is the pinned Apple Silicon build `ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2`; `JUDGE0_IMAGE` is the override boundary for other architectures or approved builds. Docker Desktop uses Judge0's per-process/thread time and memory fallback because it does not delegate a usable cgroup-v2 subtree; this is trusted-development compatibility, not production-equivalent isolation. Development also uses `COUNT=2` to prevent the host CPU count from creating an excessive isolate worker pool. Its advertised C, C++, Go, Java, JavaScript, Python, Rust, and TypeScript runtimes must remain backed by real compile/execute smoke tests.
- In production, point Cognelo to a separately hosted Judge0 server through environment configuration.
- Hidden tests live in `PluginCodingExerciseHiddenTest`.
- Teacher reference solutions live in `PluginCodingExerciseReferenceSolution`.
- Practice runs and later submissions live in `PluginCodingExerciseExecution`.
- The first execution route is `coding-exercises/run`, which stores each run server-side before and after the Judge0 request.
- Hidden tests are managed through the teacher-only `coding-exercises/hidden-tests` route.
- Bank activity authoring now has bank-owned private coding test/reference tables; course assignment must copy those private records into course-owned plugin tables via `onCourseActivityCreatedFromBankVersion` so coding exercises persist the same authoring data in banks and courses.
- Any future coding-exercise bank-owned private table must be added to the bank-to-course copy hook and the bank-activity delete cleanup hook, then manually verified by publishing a bank activity, adding it to a course, checking the course-owned plugin rows, and deleting the bank activity.
- Enabled hidden tests must validate against the private reference solution before they are saved.
- Graded submissions are handled separately from sample runs through `coding-exercises/submit`.
- Teacher authoring separates student-facing starter code from a private reference solution; the reference solution must never be stored in public activity config.
- Coding exercises use a single template-based authoring model; older `program` and `function` configs should be normalized forward rather than preserved as separate modes.
- Non-student-visible composition pieces such as the hidden template scaffold are stored in plugin-owned private data and assembled server-side before Judge0 execution.
- Template-mode authoring uses a single hidden scaffold editor with a `{{ STUDENT_CODE }}` insertion marker and optional `{{ TEST_CODE }}` hook; older prefix/suffix data should remain readable for backward compatibility.
- Template-mode teachers mark student-visible scaffold lines directly in the editor gutter; non-visible blocks collapse into a single language-appropriate hidden-code placeholder in the student-safe scaffold.
- The browser-facing `Activity.config` carries only the student-safe projected template scaffold, never the full hidden template source.
- Both visible sample tests and hidden tests can provide language-specific harness code that should be injected at `{{ TEST_CODE }}` when present so template-based exercises work across Python, C, C++, JavaScript, and similar runtimes.
- Teacher test authoring uses collapsible sample-test and hidden-test cards with saved validation status and per-test failure details.
- The same coding-exercise activity UI should work in both course-scoped teacher pages and group-scoped student assigned-activity pages by swapping the API client boundary rather than forking the plugin UI.
- Group-scoped student coding-exercise access uses assigned-activity routes under `groups/:groupId/activities/assigned/:activityId/...` to avoid route conflicts with teacher assignment-management endpoints.
- Coding plugin routes must remain plugin-owned and mounted through generic course/group plugin dispatchers, not hardcoded as plugin-specific API route files in `apps/api`.
- Student coding uses the shared Monaco editor from `@cognelo/activity-ui`, while teacher authoring still uses the in-house editor for the lighter authoring workflow.
- Plugin-owned user-facing translations should live inside the plugin package rather than in the host app's global i18n file.
- Teacher authoring forms must register with the shared unsaved-change guard from `@cognelo/activity-ui`; future coding-exercise tabs/settings should keep `isDirty`, save, and discard behavior wired through `useUnsavedChangesGuard`.
- The teacher authoring form exposes that same combined public/private draft through the shared responsive `EditActionBar`; its status becomes saved only after the entire multi-part save succeeds.
- AI-assisted coding-exercise authoring uses the selected question-authoring AI agent. Prompt generation fills only the student-facing prompt from description/language/subject context.
- Every coding generation stage receives the shared knowledge mode and complete subject catalog as a curriculum boundary. Selected skills additionally constrain output; suggestion maps the generated prompt/solution/tests to exact subject skills and updates only the unsaved host draft; ignore neither reads nor changes that draft and performs no mapping pass.
- AI-assisted coding-exercise solution/test generation is staged. Solution generation fills the teacher reference solution and a constrained execution template, clears starter code, and does not create tests. Test generation then uses the student-facing prompt, reviewed reference solution, and template to create visible sample tests and hidden tests after server-side validation against Judge0.
- AI-generated coding-exercise templates should use only two portable shapes: `{{ STUDENT_CODE }}` for full-program stdin/stdout exercises, or `{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}` for callable-unit exercises with per-test harness code. Do not generate body-insertion templates for AI assets.
- AI-generated hidden tests are capped at 15 so teachers can review them comfortably.
- Full-program AI tests must not target inputs that make the reviewed reference solution return a non-zero exit status, because Judge0 treats that execution as failed even when stdout matches. Floating-point boundary cases must use values safely inside/outside the threshold unless language-level representation has been accounted for. Test correction prompts explicitly repeat both constraints.
- AI test generation treats uniform Judge0 compilation failures and uniform internal sandbox failures as fatal reference/runtime errors rather than asking the model to rewrite otherwise valid test JSON. Local Apple Silicon development uses the pinned ARM64/cgroup-v2 image documented above; production continues to use the documented Ubuntu sandbox host.
- AI-generated coding-exercise prompts should be concrete scenario-based tasks rather than meta/concept-only prompts. For example, teach pointer/reference concepts through a small realistic use case instead of asking students to "illustrate pass-by-reference".
