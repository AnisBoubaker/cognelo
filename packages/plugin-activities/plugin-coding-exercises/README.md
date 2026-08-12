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
- run code against visible examples
- submit code for evaluation against hidden tests
- resume their work and review prior results

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

## Authoring UX

The teacher authoring UI is a form surface and must stay registered with the shared `useUnsavedChangesGuard` hook from `@cognelo/activity-ui`. Any future coding-exercise authoring tabs or settings panels should do the same so navigation can offer continue editing, save and leave, or discard and leave.

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
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/hidden-tests
PUT    /api/courses/:courseId/activities/:activityId/coding-exercises/hidden-tests
```

The run/submit routes are also available through group-scoped assigned activity dispatch. Hidden-test management is course-authoring-only for now; activity-bank authoring currently edits public config, while course copies own the private reference solution and hidden tests.

Plugin routes are declared in this package and mounted by the platform's generic dispatchers. Do not add coding-exercise-specific API route files in `apps/api`.

Behavior:

- `run` is for learner-visible sample execution
- `submit` evaluates against plugin-owned hidden tests
- `hidden-tests` is teacher/admin only and carries the private reference solution
- Judge0 source is assembled server-side from the private template plus student code, then per-test harness code is injected at `{{ TEST_CODE }}` when present
- enabled hidden tests are validated against the teacher reference solution before they are saved

For development, Judge0 runs locally in Docker on `http://localhost:2358`. Compose defaults to the pinned Apple Silicon image `ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2`; override `JUDGE0_IMAGE` when another architecture or approved build is required. The image exposes Cognelo's C, C++, Go, Java, JavaScript, Python, Rust, and TypeScript runtimes and has been validated with real submissions.

For production, `JUDGE0_BASE_URL` should point to the dedicated physical Judge0 host, ideally on a private network segment with an auth token and host-level access controls.

For local Judge0 CE setups that run on hosts without the legacy cgroup hierarchy expected by older Judge0 images, set `JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true`. Cognelo will then ask Judge0 to use per-process/per-thread enforcement instead of the older `--cg` path.

## Planned Next Modules

As this plugin grows, expect to add:

- richer execution policies per language/runtime
- richer score/rubric reporting
- responsive teacher-authoring actions use the shared `EditActionBar`, with saved/unsaved status and snapshot-backed Cancel/Save

## Contributor Workflow

When changing this plugin, update:

- `packages/plugin-activities/plugin-coding-exercises/README.md`
- `packages/plugin-activities/plugin-coding-exercises/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
