# Plugin: Coding Exercises

This README is for the coding-exercises plugin only.

It documents plugin-specific architecture, execution boundaries, and contributor workflow. Platform-wide architecture belongs in the root [README.md](../../../README.md).

## Purpose

`@cognelo/plugin-coding-exercises` provides the `coding-exercise` activity type.

Teachers will be able to:

- write a programming prompt
- choose the learner language/runtime
- provide starter code and visible sample tests
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
- `sampleTests`
- `maxEditorSeconds`

Current plugin-owned tables:

- `PluginCodingExerciseHiddenTest`
- `PluginCodingExerciseReferenceSolution`
- `PluginCodingExerciseExecution`

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

Behavior:

- `run` is for learner-visible sample execution
- `submit` evaluates against plugin-owned hidden tests
- `hidden-tests` is teacher/admin only and carries the private reference solution
- enabled hidden tests are validated against the teacher reference solution before they are saved

For development, Judge0 runs locally in Docker on `http://localhost:2358`.

For production, `JUDGE0_BASE_URL` should point to the dedicated physical Judge0 host, ideally on a private network segment with an auth token and host-level access controls.

For local Judge0 CE setups that run on hosts without the legacy cgroup hierarchy expected by older Judge0 images, set `JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true`. Cognelo will then ask Judge0 to use per-process/per-thread enforcement instead of the older `--cg` path.

## Planned Next Modules

As this plugin grows, expect to add:

- richer execution policies per language/runtime
- richer score/rubric reporting

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-coding-exercises/README.md`
- `packages/plugins/plugin-coding-exercises/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
