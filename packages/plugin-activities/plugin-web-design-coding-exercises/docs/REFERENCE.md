# Web Design Coding Exercises Detailed Reference

This document is the detailed reference for the Web Design Coding Exercises plugin.

Platform-wide architecture belongs in the root [README.md](../../../../README.md).

## Purpose

The compound Test answer review uses `hasWebDesignExerciseAnswer` to identify a nonempty change in an editable student file compared with the starter bundle. Untouched or cleared files do not count; file correctness and runner outcomes are never consulted.

`@cognelo/plugin-web-design-coding-exercises` provides the `web-design-coding-exercise` activity type.

Teachers can define a private HTML/CSS/JavaScript solution bundle and a separate student starter bundle. Activity-bank authoring stores the reusable source version; assigning that bank activity to a course creates a course-local copy. Students work only from the copied starter bundle in Monaco editor tabs and see their own result immediately in a sandboxed iframe.

Standalone student file bundles autosave through the core `ActivityResponseDraft` state host and resume after reload. Successful final submission clears that draft. Embedded Test web-design activities continue to autosave through the Test execution host and `TestItemAttempt` rather than the standalone draft route, and Test navigation remounts the workspace so file/editor state stays scoped to its item.

The course assignment policy may time a standalone web-design exercise in either assessment mode. Core owns the explicit start, live deadline, and countdown. Draft and learner-run writes stop after expiry, while the ordinary hidden-test submission route is declared as the finalization boundary. The renderer answers `TimedActivityAutoSubmit` by invoking that existing Playwright submission, which attaches the plugin result to the already-started timed core attempt and preserves normal draft cleanup and grading.

Teachers can include `{{ EXPECTED_RESULT }}` in the prompt to show students a visual target, or `{{ EXPECTED_RESULT_CROPPED }}` to trim large plain background regions around that target. Cognelo replaces either token with a screenshot generated from the private solution bundle; this prompt endpoint returns only the image artifact. Reference source is available separately only through an explicitly enabled solution reveal.

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

Core submission metadata retains `submittedFiles`. The shared Deleted submissions view renders those student files and the teacher’s reason without exposing reference files or grade snapshots; existing deletion snapshots need no backfill.

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
- `PluginBankWebDesignExerciseReferenceBundle`: bank-owned private reference bundle for reusable authoring
- `PluginBankWebDesignExerciseTest`: bank-owned sample and hidden Playwright tests

These tables are modeled in this plugin's local Prisma schema under `prisma/schema.prisma`; server-side persistence uses the plugin-local Prisma client from `src/db-client.ts`.

When a web-design bank activity is copied into a course, the plugin's server hook copies the bank reference bundle and tests into the course-owned plugin tables. After that, course edits and bank edits are independent.

Explicit synchronization replaces private reference bundles/tests through plugin hooks: retrieval refreshes course-owned rows and is blocked after any attempt, while publishing refreshes bank-owned rows after core creates a new immutable bank version. Publishing remains allowed after attempts because it does not replace the attempted course copy.

Bank-version comparison currently covers generic student-facing configuration only. Private reference bundles and Playwright tests are excluded because their bank rows are not immutable per-version snapshots.

Draft saves update mutable public/private bank authoring without creating a version. A changed Published save creates the next immutable generic snapshot; private rows remain unversioned.

Duplicating a web-design activity inside a bank copies its private bank reference bundle and tests through the platform bank-duplication hook. Moving the activity retains its ID and therefore retains those private rows without migration.

Reusable bank Tests dispatch that same lifecycle per owned web-design child. A copied bank source becomes an independent hidden bank activity; course import and course publication copy its private bundle/tests in the appropriate direction; whole-Test duplication and deletion invoke the existing child hooks with compensation on failure.

## Authoring UX

Code fields use the shared first-party Monaco loader. See [frontend decisions](../../../../docs/reference/PLATFORM_DECISIONS.md#frontend-platform-decisions) for the absolute-URL worker requirement. The `monaco-workers.spec.ts` browser regression executes HTML/CSS formatting and JavaScript diagnostics for learner use and teacher inspection of an expired assignment without running a grader.

The teacher authoring UI is tabbed, but it still behaves as one guarded form. Keep it registered with `useUnsavedChangesGuard` from `@cognelo/activity-ui`, and register any future web-design authoring/settings panels with the same dirty/save/discard pattern. Test removal uses the shared promise-based dialog provider rather than a native browser confirmation; browser modal APIs remain available only to learner-authored code in the sandboxed preview.

Saving the combined authoring draft is a long-running operation whenever it validates enabled tests or captures an expected-result screenshot. It and learner Playwright run/submit requests use the shared blocking progress dialog with an indeterminate bar. Activity-bank variations instead expose the host background job's measured progress.

The activity-bank **Create variation** action runs against an independent deep duplicate. Its plugin handler preserves exact file paths and the original test count/order/kinds/weights while generating a meaningfully different prompt, student starter code, private reference code, test names, and Playwright assertions at comparable complexity. Optional dialog instructions are generation-only. The handler saves through the ordinary test-management boundary, so every enabled test must pass the new reference bundle and any `{{ EXPECTED_RESULT }}` or cropped token produces a fresh screenshot. A reusable Test variation invokes this handler for each web-design child and includes validation in the progress report.

## Playwright Grading

Core applies [team and student assignment exceptions](../../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md) to access, timing, attempts, grading, and challenge policy. Plugin routes consume the resolved assignment and core grade services; unsubmitted attempt deadlines resolve the latest effective limit from the original start, and the host refreshes policy every 20 seconds. Submitted timing stays fixed.

Student view runs the selected sample or hidden suite through Playwright but constructs the response in memory. It does not create `PluginWebDesignExerciseSubmission` or test-result rows and is available only through the SDK stateless preview dispatcher.

Implemented plugin subroutes:

```text
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/tests
PUT    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/tests
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/expected-result
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/run
POST   /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/run
GET    /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/submit
POST   /api/courses/:courseId/activities/:activityId/web-design-coding-exercises/submit

GET    /api/activity-banks/:activityBankId/activities/:bankActivityId/web-design-coding-exercises/tests
PUT    /api/activity-banks/:activityBankId/activities/:bankActivityId/web-design-coding-exercises/tests
GET    /api/activity-banks/:activityBankId/activities/:bankActivityId/web-design-coding-exercises/expected-result
```

The same learner run/submit routes are available through group-scoped assigned activity dispatch. Bank routes are available through the generic activity-bank plugin dispatcher; they are not hardcoded as web-design-specific API route files in `apps/api`.

The test-management route is teacher/admin-only for course copies and bank-owner/admin-only for bank activities. It persists the reference bundle plus sample/hidden Playwright tests. Enabled tests must pass against the teacher reference bundle before they are saved. Student run uses enabled sample tests; student submit uses enabled hidden tests.

The submit flow is:

1. web UI calls a Cognelo plugin route
2. plugin route authenticates the user and loads the activity
3. plugin service stores a pending submission
4. Cognelo sends the submitted file bundle and enabled tests to an external Playwright runner
5. the runner renders the submitted page in an isolated browser context
6. the runner returns normalized test results
7. Cognelo stores filtered results and returns them to the browser

Ordinary learner config, runs, submissions, and grading reports exclude hidden tests and reference files. Only the explicitly authorized Solution tab may receive the reference source; it never receives hidden tests. Teacher authoring loads the complete private reference bundle through teacher/admin-only plugin routes.

When a teacher saves tests, Cognelo sends the private solution bundle plus all enabled tests to the runner first. If any enabled test fails, the save is rejected and the previous saved tests remain in place. Disabled tests are persisted without being executed and are marked as skipped in their validation summary.

If the prompt contains `{{ EXPECTED_RESULT }}` or `{{ EXPECTED_RESULT_CROPPED }}`, saving tests and solution also asks the Playwright runner to render the private solution bundle and capture a PNG screenshot. The cropped token additionally trims large plain background regions while keeping padding around the visible content. The screenshot is stored in plugin-owned reference metadata and exposed to students through a student-safe expected-result route.

## Docker Runner

The Playwright runner lives in `packages/web-design-runner` and is intended to run in Docker with the official Playwright image, so Chromium and system dependencies are container-managed rather than installed on each developer machine.

```text
npm run dev:runner
```

The runner listens on port `3456`. Administrators configure its base URL and required `Authorization` header with token `Bearer <credential>` under **Settings → Runners**; the local development seed creates `http://localhost:3456`, encrypting the configured `WEB_DESIGN_RUNNER_TOKEN` for new settings or leaving the new row disabled if no token is configured. Existing settings are preserved. Runtime plugin code resolves the endpoint through core rather than reading an environment variable. Running `docker compose up -d web-design-runner` is equivalent to `npm run dev:runner`.

Every endpoint authenticates before parsing work. Set a unique `WEB_DESIGN_RUNNER_TOKEN` of at least 32 characters on the runner (for example, generate 32 random bytes with `openssl rand -hex 32`) and store the matching Bearer credential in the application runner settings. Restart the runner and update that setting together when rotating. Missing configuration prevents startup; missing/incorrect credentials return 401. Local binding defaults to loopback; containers explicitly bind internally and development publishes only loopback.

`GET /health` returns `{ ok: true, capabilities: ["run", "screenshot"] }`. The settings card uses this manifest to verify the endpoint, authentication path, browser-test execution contract, and screenshot capability before reporting the runner ready.

Teacher authoring uses the shared responsive `EditActionBar` across its tabs. Saved/unsaved status covers the combined activity, file, solution, and test draft, and Cancel restores the last complete saved snapshot.

The activity definition uses the semantic `browser-code` icon rendered by the platform's shared Tabler icon layer.

## Contributor Workflow

Every standalone submission creates a core attempt tagged with the assignment's formative/summative mode. Standalone gradebook **Class overview** loads the private reference bundle and the latest plugin submission referenced by each row's current mode through teacher-authorized routes. It shows one green/red pass/fail bar per enabled hidden Playwright test, and hovering either segment lists the students in it. The shared attempt inspector can navigate every submitted HTML/CSS/JavaScript bundle and is read-only for formative attempts; summative work permits an audited final-grade override. When the effective summative assignment setting enables challenges, released automatic or teacher-overridden grades are challengeable through core and reopen this same file-aware review surface. The UI omits **Rerun automatic grading** because this plugin does not implement a current-answer regrading handler.

When changing this plugin, update this detailed reference, the package README if its overview or routing changed, and `PROJECT_MEMORY.md` only when a durable invariant changed. Update root documents only for platform-wide contracts.

## Reopening the last submission

Restores files from the exact learner-owned submission to the core response draft without changing the immutable submitted bundle or test results. Ordinary resubmission attaches fresh evidence to the same core attempt. The shared [continuation service](../../../../docs/SUBMISSION_CONTINUATION.md) enforces latest-attempt and staff scope, archives prior evidence, preserves attempt identity and original start, and applies current General/section/team/student settings. Later extensions or individual exceptions therefore affect the resumed deadline without resetting it.


## Live authoring and grade visibility

Live prompt/config refresh preserves the learner file bundle. Course private saves use the core live-authoring transaction and append full before/after data to `PluginWebDesignExerciseAuthoringRevision`; core audits retain only hashes. Migration `202610130010_authoring_revisions` is registered in `src/db.ts`, including backup ownership, and deletion hooks remove revisions. Existing reference validation remains mandatory. Summative submission/history APIs redact scores, test outcomes, summaries, and diagnostics before release; practice sample runs retain feedback.

Shared confirmation, submitted-Test snapshots, and concurrency are documented in [Live activity authoring](../../../../docs/LIVE_ACTIVITY_AUTHORING.md).


## Explicit solution release

This type supports the shared [Solution tab](../../../../docs/ACTIVITY_SOLUTIONS.md). Course settings must opt in; summative work additionally requires grade release. The learner first sees encouragement to try independently and must press **Show solution**. The same provider serves this type inside a Test under the parent switch. See the linked reference for formats, live revocation, API boundaries, and current-reference semantics.

## Test automatic regrading

The core [Test regrading batch](../../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading) reevaluates every submitted child against current grading rules, including previously graded work. Individual and whole-class actions show measured progress. Saved answers, original timing, submitted composition/point weights, and grade-release state remain fixed. Each successful rerun is audited; an individual failure does not stop later exercises, and an incomplete batch leaves the parent total unchanged. Recovery may initially preserve responses without a grade or runner artifact; later teacher regrading uses the same batch. No AI feedback is requested automatically. Standalone behavior is unchanged.

## Restricted student review

The optional [core content-closure policy](../../../../docs/ACTIVITY_CONTENT_ACCESS.md) governs learner retrieval after permitted attempts end, including compound Test children. Shared dispatch denies closed content/history/file reads and returns only a closure signal after the final submission; teacher inspection and stored evidence remain intact. Released grades do not authorize detailed reports or solutions while closed.

## Editor history and draft restoration

Use the shared [editor undo lifecycle](../../../../docs/EDITOR_UNDO.md). Draft loading gates editing and offers Retry on failure. Restored answers establish a baseline without firing an autosave; real typing, undo, and redo use the existing ordered answer persistence. The Test host retains separate per-question/file models in memory only and disposes them on session/view changes. Reopening or reloading uses the saved answer with empty undo history.

## Shared action controls

Teacher, learner, and settings actions follow the platform [button and icon contract](../../../../docs/ACTION_BUTTONS.md). Use explicit semantic `ActionIcon` names with localized labels; dimensions and interaction colors are shared CSS, while tabs, disclosure rows, and specialized editor controls retain their own layout.

## Answer exports

The plugin implements `submissionExport.getContent` for the [shared PDF/ZIP export](../../../../docs/ANSWER_EXPORTS.md). Exports display submitted HTML/CSS/JavaScript as escaped source and optionally include stored test results. Prompt image tokens resolve to the already-stored expected-result screenshot; exporting never captures a new screenshot. They never execute student files or invoke the runner. The host enforces teacher/section scope, submission lifecycle, exact attempt selection, and prompt/grading switches. Private provider requests, credentials, and provenance are never exported.

## Learner data boundaries

The definition’s `studentConfig` validates learner transport with the public starter-file schema. The runner requires a dedicated Bearer credential and interprets a bounded Playwright command subset; test source never executes in Node. See the runner contract below.

## Runner command contract

Tests support `const`, `await`, scalar/array/object literals, locator chains (`locator`, `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`, `getByTestId`, `getByAltText`, `getByTitle`, `first`, `last`, `nth`, `filter`), common locator actions, and explicit `expect` assertions with optional `.not`. The exact allowlists live in `packages/web-design-runner/src/test-program.ts`. DOM computations may run inside `page.evaluate` or `locator.evaluate` callbacks in Chromium. Imports, Node globals, arbitrary property/method access, helper functions, loops outside callbacks, regex literals, and browser/context/network APIs are rejected. Existing tests using unsupported syntax must be rewritten and reference-validated before use.

The runner never evaluates test source in Node or `node:vm`. It allows one active request, rejects excess work with 429, limits command steps to 2,000, applies the requested per-test timeout and a 60-second request watchdog (the Cognelo HTTP client aborts after 65 seconds), closes timed-out browser work, bounds diagnostic text and screenshot dimensions, blocks browser network requests/service workers/downloads, and enables Chromium sandboxing. Docker additionally limits CPU, memory, processes, and temporary storage; runs non-root with a read-only filesystem, dropped capabilities, and no repository mount. Production requires the dedicated disposable host and internal network in the deployment guide. Development changes require rebuilding the image (`npm run dev:runner -- --build`).

The checked-in seccomp profile is derived from [Playwright 1.64.1](https://github.com/microsoft/playwright/blob/v1.64.1/utils/docker/seccomp_profile.json), with `chroot` allowed for the inner Chromium namespace while outer capabilities remain dropped. Its Apache 2.0 license is retained beside the profile.

Run, submit, Test, and preview requests reconstruct files from trusted activity configuration: IDs, paths, languages, editability, ordering, and locked text are server-owned. Extra files are ignored; only editable file text is accepted and the evaluated bundle is what persistence/gradebook metadata records. Draft restoration applies the same constraint. Test regrading uses the original trusted configuration for file constraints and preserves the submitted answer. Standalone submit checks attempt availability before invoking the runner, then retains the atomic core attempt check at persistence; an invalid operational result does not consume a core attempt. Runner calls reject redirects, bound JSON results to 8 MiB (screenshots to 32 MiB), and use a 65-second deadline. HTTP error bodies are withheld.

## Deadline finalization

The shared assigned dispatcher checks the effective deadline after the request body arrives. At expiry, this plugin’s `expiredAttemptInput` supplies only its saved server response; incoming answer/code/file changes are ignored. Missing saved work follows the ordinary ungraded timeout fallback. This also applies to a request opened before the deadline whose body finishes later. See [security boundaries](../../../../docs/SECURITY_BOUNDARIES.md).

The production runner image starts Node directly, omits global npm and unused Firefox/WebKit engines, and removes unused bad GStreamer plugins. Keep Chromium/package versions aligned and repeat actual grading plus cropped-screenshot checks when rebuilding; package audit alone does not cover OS/browser dependencies.
