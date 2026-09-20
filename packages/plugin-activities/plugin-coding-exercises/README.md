# Plugin: Coding Exercises

This README is for the coding-exercises plugin only.

It documents plugin-specific architecture, execution boundaries, and contributor workflow. Platform-wide architecture belongs in the root [README.md](../../../README.md).

## Purpose

`@cognelo/plugin-coding-exercises` provides the `coding-exercise` activity type.

Teachers will be able to:

- write a programming prompt
- choose the learner language/runtime
- provide starter code and visible sample tests
- add optional per-test harness code for visible and hidden tests
- provide a template scaffold with a `{{ STUDENT_CODE }}` insertion marker, and optionally a `{{ TEST_CODE }}` insertion marker for per-test harness execution
- choose which scaffold lines remain visible to students while hidden blocks collapse to a language-appropriate `Hidden code` placeholder
- define hidden tests and grading rules
- run submissions against a remote Judge0 service

Students will be able to:

- read the prompt and write code in the shared Monaco editor
- run code against visible examples or with personalized input
- submit code for evaluation against hidden tests
- resume their work and review prior results

The learner workspace places the code editor and submission action in the left column and the test controls in the right column. It starts with a two-thirds/one-third split, exposes an accessible draggable divider that can also be resized with the keyboard, and collapses responsively on narrow screens. Students can elevate this same live workspace into a viewport-filling focus mode without losing editor contents, the selected test, output, or the current divider position; the exit control or Escape restores the inline view. In the two-column layout, the editor stretches to the full height of the test runner while the submission action remains directly below it. Monaco loads from Cognelo's first-party web assets rather than a runtime CDN so it works in restricted SEB sessions; if Monaco initialization still fails, the shared editor preserves the same controlled learner source and protected template boundaries in a plain-text fallback. The test selector wraps its selected label and uses the shared anchored-popover primitive so full test names remain readable even when the test column is narrow. Selecting a visible test displays its input, expected output, comparison mode, and ordering option as compact read-only information; its saved harness is applied server-side but is not shown to the learner. Selecting **Personalized test** preserves a separate editable custom input, hides expected-output and harness information, runs without an output assertion or sample harness, and shows the raw execution output without a pass/fail mark. Test-runner controls remain top-aligned in both modes, and only the output panel grows to consume unused vertical space.

Preset-test and submission outcomes use only an accessible green checkmark or red cross. Judge0 lifecycle/status labels remain internal diagnostics rather than student-facing success text; pending executions retain a neutral pending label until an outcome exists, and personalized runs deliberately show no outcome mark because they do not compare output.

Standalone student source code autosaves through the core `ActivityResponseDraft` state host and is restored on reload. Every completed or failed submission clears that draft and resets the editor to the activity's starter code. Embedded Test coding exercises continue to use the Test execution host and its `TestItemAttempt` autosave queue. When a Test item has no saved source, its own configured starter code is displayed and persisted; Test navigation remounts the workspace so source and hidden-template placeholders cannot leak between questions.

Standalone learners use the host's **New attempt** and **Previous submissions** tabs once at least one submission exists. The current attempt shows the prompt and only runs created after the latest submission. Run cards include the saved standard input as well as Judge0 output and diagnostics. The previous-submissions tab omits the prompt and lists submissions newest-first as accordions; expanding one shows the submitted source, its hidden-test result, and every practice run made after the preceding submission and before that submission. This timestamp projection also organizes execution history created before the attempt-history UI existed, so no execution-table migration is required. Submission opens a confirmation dialog after the result is recorded and moved to history. Summative group submissions also use the shared core attempt lifecycle and assignment attempt limits; when no attempt remains, the host exposes only previous submissions and confirmation sends the learner back to course content.

## Package Contents

```text
src/
  coding-exercises.ts    Shared config parsing and runtime language helpers
  db.ts                  Plugin DB manifest
  executions.ts          Persistence and Judge0-backed run service
  hidden-tests.ts        Hidden-test persistence and teacher-only management
  index.ts               Public plugin exports
  judge0.ts              Shared Judge0 client for server-side plugin routes
  plugin.ts              Activity plugin definition and public config schema
  routes.ts              Plugin-owned run/history subroutes
  server.ts              Server plugin registration
  web/
    coding-exercise-activity-view.tsx
                          Plugin-owned authoring and learner UI
```

## Architecture Boundary

The coding-exercises plugin should keep a strict separation between:

- public activity config that is safe to send to students
- private plugin-owned grading data that must never be exposed to the browser
- remote code execution through Judge0, always initiated by Cognelo server routes

The first implementation pass keeps only student-visible fields in `Activity.config`:

- `prompt`
- `language`
- `starterCode`
- `studentTemplateSource`
- `sampleTests`
- `maxEditorSeconds`

Private plugin-owned data stores:

- teacher reference solution
- hidden template scaffold
- visible line selections for the student-safe scaffold projection
- hidden test harness code and metadata

Current plugin-owned tables:

- `PluginCodingExerciseHiddenTest`
- `PluginCodingExerciseReferenceSolution`
- `PluginCodingExerciseExecution`
- `PluginBankCodingExerciseHiddenTest`
- `PluginBankCodingExerciseReferenceSolution`

These tables are modeled in this plugin's local Prisma schema under `prisma/schema.prisma`; plugin server code uses the plugin-local Prisma client from `src/db-client.ts`, not the core Prisma client.

Activity-bank authoring persists the same private reference solution, hidden template data, and tests in bank-owned plugin tables. When a bank activity is assigned to a course, the plugin hook copies that private data into course-owned plugin tables so future bank edits and course edits diverge safely.

Explicit course/bank synchronization replaces private authoring data through plugin hooks in either direction. Retrieval refreshes course-owned reference/test rows and is blocked after any attempt. Publishing refreshes bank-owned rows while core creates the new immutable generic version, and remains allowed after attempts because it does not change the attempted course copy.

Bank-version comparison currently shows public generic configuration but not private reference solutions, hidden templates, or hidden tests, because those bank-owned rows are not snapshotted per immutable activity version.

Generic versions are created only for changed Published saves. Draft saves update mutable public and private bank authoring without creating a version; private rows remain outside immutable snapshots.

Duplicating a coding exercise inside an activity bank invokes the platform bank-duplication hook and copies its bank-owned reference solution and hidden tests to the new independent bank activity. Moving a bank activity keeps its ID, so its plugin-owned rows move with it without copying.

## Authoring UX

The teacher authoring UI is a form surface and must stay registered with the shared `useUnsavedChangesGuard` hook from `@cognelo/activity-ui`. Any future coding-exercise authoring tabs or settings panels should do the same so navigation can offer continue editing, save and leave, or discard and leave.

The student-facing prompt is authored with the shared visual/Markdown `RichTextEditor` and remains stored as Markdown. Its Visual and Markdown bodies have the same fixed height, resize together from the bottom handle, scroll internally, and can each use the editor's far-right full-screen action. Its equation action opens the shared visual equation builder for mouse/touch construction and inline/display insertion; clicking a rendered formula reopens the builder for editing or removal. Visual mode preserves the original delimited Markdown, and complete formulas entered or pasted there also render after focus leaves. The table action inserts portable GFM tables from a row/column dialog, and selecting a cell exposes row and column insertion/removal controls; merging is omitted because standard GFM cannot represent spans. The image action uploads a PNG, JPEG, GIF, or WebP through the platform media service, requires alternative text, provides pixel/original-percentage/container-percentage sizing, and lets the author click an image to replace, edit, resize, or remove it. Bank versions, course copies, and Test snapshots retain their own logical references while identical physical bytes remain deduplicated. Learner current-attempt views render the prompt through the shared sanitized `MarkdownRenderer`, including headings, lists, emphasis, images, tables, fenced code, and KaTeX-compatible inline or `$$ ... $$` display math. Previous-submission views intentionally continue to omit the prompt.

When a teacher has selected an enabled question-authoring AI agent in global settings, the authoring UI can generate the student-facing prompt from the activity description, language, and subject context.

Prompt, solution, and test generation all use the shared knowledge-alignment choice. Every mode provides the complete subject catalog as a curriculum boundary. `Use selected skills` additionally adds the activity's current draft skills as specific constraints, `Suggest skills` replaces the unsaved host Concepts-tab draft with exact catalog skills inferred from the generated artifact, and `Ignore skills` neither reads nor changes that draft and performs no suggestion pass.

AI-assisted solution and test generation is intentionally staged:

1. Generate the reference solution and execution template. This clears starter code so the teacher can review the proposed answer before deciding what students should receive.
2. Generate visible and hidden test cases from the student instructions, reviewed reference solution, and template. Generated tests are validated server-side against Judge0 before they are inserted into the form.

AI-generated templates use one of two portable execution shapes:

- full-program exercises: `{{ STUDENT_CODE }}` with stdin/stdout tests and empty test harness code
- callable-unit exercises: `{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}` with per-test harness code

AI-generated hidden tests are capped at 15.

Generated full-program tests must use inputs for which the reviewed reference solution exits successfully. The generator is explicitly told not to exercise invalid-input branches that return a non-zero status and to avoid ambiguous floating-point threshold values; execution-validation retries repeat those constraints when correcting a rejected suite.

## AI Assessment Feedback And Grading

Programming Exercises declare both AI-feedback and AI-feedback-grading capabilities. The activity's private reference-solution row owns `privateConfig.aiFeedback`; enabling it requires a rubric name/version, evaluator instructions, at least one uniquely identified criterion whose weights total 100, and—when AI grading is enabled—deterministic-test and AI-rubric weights that total 100. This configuration is private and is copied by the existing bank/course lifecycle hooks with the other reference data.

The rubric editor validates that complete private configuration inline before enabling Save. Adding or removing a criterion assigns a collision-free private criterion ID and redistributes integer criterion weights to total 100%; teachers can then adjust those weights as long as the final total remains 100. This prevents incomplete drafts from reaching the generic API-validation path while keeping the server schema authoritative.

Effective use also requires the course assessment-feedback switch and an accessible dedicated course model. A formative learner submission calls the evaluator immediately and returns sanitized summary, strengths, improvements, and criterion feedback without creating a core grade. A summative submission persists the plugin execution and core attempt but does not invoke AI. The detailed gradebook teacher action evaluates one attempt or a sequential batch directly; no background job or submission trigger runs summative AI grading.

Every submitted `PluginCodingExerciseExecution` snapshots the effective private feedback configuration so later teacher evaluation cannot silently use a changed rubric. `PluginCodingExerciseAiEvaluation` stores each immutable evaluation version, including the rubric/request snapshot, provider/model, prompt/schema versions, raw response, parsed and sanitized outputs, hashes, latency, deterministic score, AI rubric score, and combined weighted score. Strict schema validation allows one bounded correction retry. Raw artifacts remain teacher/private data; student DTOs receive only the sanitized result.

When AI grading is enabled, the plugin returns the configured combined score (for example, 60% deterministic hidden tests and 40% AI rubric) to the ordinary core gradebook lifecycle. Released AI-graded feedback can be challenged through the shared course workflow. Feedback-only configurations leave the deterministic test grade unchanged and are not challengeable.

The plugin registers a teacher feedback renderer and server handlers. From detailed gradebook results, **Feedback** is available for every submitted exercise and whole-group review navigates all submitted learners. The teacher sees the submitted source and always gets one multiline field each for Summary, Strengths, and Improvements without needing AI. Generated content pre-populates those same fields; its rubric adds editable criterion percentages and narrative. Blank Summary, Strengths, or Improvements values are allowed and omitted from learner views. Changing a criterion percentage recomputes the weighted AI and combined score while keeping the deterministic test result and configured component/criterion weights fixed. Saving that change invokes the shared audited regrade service and records `feedback_teacher_grade_adjusted`; narrative-only saves do not regrade. The first manual save records `feedback_teacher_authored` and is retained on the attempt until grading; later grading carries it into the learner-visible grade unless generated feedback supersedes it. Generated evaluation artifacts remain immutable, later edits record `feedback_teacher_revised`, and challenged generated versions are locked. Learner-facing feedback copy deliberately says only “Feedback” and does not identify AI as the generator or grader.

### Development feedback-review fixture

The root Prisma seed publishes `C exercise: Median of three integers` as `seed-bank-activity-c-median-feedback` in the Programming basics bank and as `seed-activity-c-median-feedback` in Programming 101. It includes five exact-output hidden tests plus a private rubric that combines deterministic tests at 60% with rubric assessment at 40%. The activity is assigned summatively to all course sections. A clean seed creates 36 submitted attempts across Sections A and B: six correct programs, three programs with compilation errors, and varied programs with logic or exact-output-contract errors. If other linked students already exist in either section, the seed gives them submissions too. Executions snapshot the rubric, but evaluations and grades are intentionally absent until a teacher invokes the normal summative batch action.

## Judge0 Integration

The browser should never call Judge0 directly.

The intended flow is:

1. web UI calls Cognelo plugin route
2. plugin route authenticates the user and loads the activity
3. plugin service builds a Judge0 submission payload
4. Cognelo server calls Judge0 with server-side credentials
5. Cognelo stores normalized run/submission results
6. Cognelo returns a filtered result to the browser

Implemented subroute:

```text
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/run
POST   /api/courses/:courseId/activities/:activityId/coding-exercises/run
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/submit
POST   /api/courses/:courseId/activities/:activityId/coding-exercises/submit
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/history
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/hidden-tests
PUT    /api/courses/:courseId/activities/:activityId/coding-exercises/hidden-tests
```

The run/submit routes are also available through group-scoped assigned activity dispatch. Hidden-test management is course-authoring-only for now; activity-bank authoring currently edits public config, while course copies own the private reference solution and hidden tests.

Plugin routes are declared in this package and mounted by the platform's generic dispatchers. Do not add coding-exercise-specific API route files in `apps/api`.

Behavior:

- `run` is for learner-visible preset and personalized execution; personalized runs explicitly disable output comparison and omit the sample harness
- `submit` evaluates against plugin-owned hidden tests, records summative group work in the shared core attempt lifecycle, and returns post-submission attempt availability
- blank or whitespace-only learner source keeps Run and Submit disabled; server validation also rejects direct empty payloads before runtime lookup, execution persistence, or a Judge0 request
- `history` returns every prior submission with the practice runs that preceded it, plus only the unsubmitted runs belonging to the current attempt and the learner's current attempt availability
- `hidden-tests` is teacher/admin only and carries the private reference solution
- Judge0 source is assembled server-side from the private template plus student code, then per-test harness code is injected at `{{ TEST_CODE }}` when present
- Cognelo always exchanges source, stdin, expected output, stdout, stderr, compiler output, and Judge0 messages as Base64 at the Judge0 boundary, decoding them before persistence and comparison. This preserves UTF-8 program text and output such as accented characters and also safely carries non-printable diagnostics.
- enabled hidden tests are validated against the teacher reference solution before they are saved

### Output matching

Each visible or hidden test has an explicit output comparison mode:

- **Exact** is the default and preserves legacy behavior by sending `expected_output` to Judge0. Tests saved before comparison modes existed normalize to Exact.
- **Contains lines** treats every non-empty expected-output line as literal text and requires it to occur within a stdout line; surrounding text on that stdout line is allowed. Trailing whitespace is removed from both expected and actual lines before comparison, while leading whitespace remains significant. Extra output is allowed. Teachers can optionally require the literal occurrences to appear in their authored order; duplicate expected lines require the same number of non-overlapping output occurrences.
- **Regular expression** searches stdout with the linear-time RE2 WebAssembly engine. It does not support backreferences or lookaround, and patterns are limited to 4,000 characters.

For Contains lines and Regular expression, Cognelo omits Judge0's `expected_output`. Judge0 must first report a successful compile and execution; Cognelo then evaluates stdout with the selected comparator. Compilation, runtime, resource-limit, and other sandbox failures always fail the test before output matching. The same comparator is used for teacher reference validation, student sample runs, and hidden-test grading.

For development, Judge0 runs locally in Docker on `http://localhost:2358`. Compose defaults to the pinned Apple Silicon image `ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2`; override `JUDGE0_IMAGE` when another architecture or approved build is required. The image exposes Cognelo's C, C++, Go, Java, JavaScript, Python, Rust, and TypeScript runtimes and has been validated with real submissions. Cognelo resolves only explicitly supported Judge0 runtime names; keep that allowlist synchronized with the exact versions advertised by the pinned image whenever the image changes. Both development Judge0 containers mount `infra/judge0/isolate.dev.conf`, whose expanded box range prevents Isolate 2.x from rejecting monotonically increasing Judge0 submission IDs after the default first 1,000 executions.

Judge0 compiler options remain disabled at the submission API boundary. Instead, both Compose stacks run the checked-in idempotent language-configuration SQL before starting workers. It adds the ordinary course-level Linux system libraries to every active C and C++ compile command: POSIX threads, math, dynamic loading, and POSIX realtime (`-pthread -lm -ldl -lrt`). The C and C++ driver already links the language standard library, while optional third-party libraries remain outside Cognelo's guaranteed runtime contract. Any Judge0 image or configuration upgrade must pass a real C `sqrt()` compile/execute smoke test.

For production, `JUDGE0_BASE_URL` should point to the dedicated physical Judge0 host, ideally on a private network segment with an auth token and host-level access controls.

For local Judge0 CE setups that run on hosts without the legacy cgroup hierarchy expected by older Judge0 images, set `JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true`. Cognelo will then ask Judge0 to use per-process/per-thread enforcement instead of the older `--cg` path.

Judge0 status 13 (`Internal Error`) is an execution-service failure, never a learner test result. The plugin records the execution as failed before a trustworthy result, returns a retryable service error, and does not convert the affected hidden test into a wrong answer, partial grade, or plugin-counted submission attempt. Practice runs preceding that operational failure stay attached to the learner's next trustworthy submission. Legacy executions that persisted status 13 inside a finished result are excluded from learner history and teacher review, and AI evaluation refuses them. If such an execution already created a core summative attempt, a teacher must use the audited submission-delete action so core attempt limits and gradebook state are reconciled. Operators should inspect the Judge0 logs using the returned request time; the server log includes the Judge0 token and decoded internal message.

## Planned Next Modules

As this plugin grows, expect to add:

- richer execution policies per language/runtime
- richer teacher-side score/rubric comparison and operational metrics
- responsive teacher-authoring actions use the shared `EditActionBar`, with saved/unsaved status and snapshot-backed Cancel/Save

## Contributor Workflow

Standalone gradebook **Review all** loads the private teacher reference solution and latest student submissions through teacher-authorized routes, then shows one green/red pass/fail bar per enabled hidden test. Hover text lists the students in each result segment.

When changing this plugin, update:

- `packages/plugin-activities/plugin-coding-exercises/README.md`
- `packages/plugin-activities/plugin-coding-exercises/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
