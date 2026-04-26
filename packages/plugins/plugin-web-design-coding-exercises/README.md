# Plugin: Web Design Coding Exercises

This README is for the web-design-coding-exercises plugin only.

It documents plugin-specific architecture, browser preview boundaries, and planned Playwright grading. Platform-wide architecture belongs in the root [README.md](../../../README.md).

## Purpose

`@cognelo/plugin-web-design-coding-exercises` provides the `web-design-coding-exercise` activity type.

Teachers can define a private HTML/CSS/JavaScript solution bundle and a separate student starter bundle. Students work only from the starter bundle in Monaco editor tabs and see their own result immediately in a sandboxed iframe.

Teachers can include `{{ EXPECTED_RESULT }}` in the prompt to show students a visual target, or `{{ EXPECTED_RESULT_CROPPED }}` to trim large plain background regions around that target. Cognelo replaces either token with a screenshot generated from the private solution bundle; the student browser receives only the image artifact, never the solution source files.

## Package Contents

```text
src/
  db.ts                         Plugin DB manifest
  index.ts                      Public plugin exports
  plugin.ts                     Activity plugin definition
  routes.ts                     Plugin-owned test management and execution subroutes
  server.ts                     Server plugin registration
  tests.ts                      Reference bundle and Playwright test persistence
  runner.ts                     HTTP client for the external Playwright runner
  executions.ts                 Student run/submit persistence and result normalization
  web-design-coding-exercises.ts
                                Shared config parsing and preview helpers
  web/
    web-design-coding-exercise-activity-view.tsx
                                Plugin-owned authoring and learner UI
```

## Architecture Boundary

The plugin separates:

- public activity config that is safe to send to students
- private Playwright tests and reference solutions that must stay server-side
- visual preview, which runs client-side in a sandboxed iframe
- graded execution, which should run through an external Playwright runner service behind Cognelo routes

The implementation keeps only student-visible starter fields in `Activity.config`:

- `prompt`
- `files` (student starting files only)
- `previewEntry`
- `maxEditorSeconds`

Plugin-owned persistence:

- `PluginWebDesignExerciseReferenceBundle`: private teacher solution file bundle and validation summary
- `PluginWebDesignExerciseTest`: sample and hidden Playwright tests
- `PluginWebDesignExerciseSubmission`: student run/submit file bundle and overall result summary
- `PluginWebDesignExerciseTestResult`: normalized per-test result records

## Playwright Grading

Implemented plugin subroutes:

```text
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/tests
PUT    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/tests
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/run
POST   /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/run
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/submit
POST   /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/submit
```

The same routes are available through group-scoped assigned activity dispatch. The test-management route is teacher/admin-only and persists the reference bundle plus sample/hidden Playwright tests. Enabled tests must pass against the teacher reference bundle before they are saved. Student run uses enabled sample tests; student submit uses enabled hidden tests.

The submit flow is:

1. web UI calls a Cognelo plugin route
2. plugin route authenticates the user and loads the activity
3. plugin service stores a pending submission
4. Cognelo sends the submitted file bundle and enabled tests to an external Playwright runner
5. the runner renders the submitted page in an isolated browser context
6. the runner returns normalized test results
7. Cognelo stores filtered results and returns them to the browser

The student browser should never receive hidden tests or private solution/reference files. Teacher authoring loads the private reference bundle through teacher/admin-only plugin routes.

When a teacher saves tests, Cognelo sends the private solution bundle plus all enabled tests to the runner first. If any enabled test fails, the save is rejected and the previous saved tests remain in place. Disabled tests are persisted without being executed and are marked as skipped in their validation summary.

If the prompt contains `{{ EXPECTED_RESULT }}` or `{{ EXPECTED_RESULT_CROPPED }}`, saving tests and solution also asks the Playwright runner to render the private solution bundle and capture a PNG screenshot. The cropped token additionally trims large plain background regions while keeping padding around the visible content. The screenshot is stored in plugin-owned reference metadata and exposed to students through a student-safe expected-result route.

## Docker Runner

The Playwright runner lives in `packages/web-design-runner` and is intended to run in Docker with the official Playwright image, so Chromium and system dependencies are container-managed rather than installed on each developer machine.

```text
npm run dev:runner
```

The runner listens on port `3456`. The API reads `WEB_DESIGN_RUNNER_URL`, which defaults to `http://localhost:3456` for local development. Running `docker compose up -d web-design-runner` is equivalent to `npm run dev:runner`.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-web-design-coding-exercises/README.md`
- `packages/plugins/plugin-web-design-coding-exercises/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
