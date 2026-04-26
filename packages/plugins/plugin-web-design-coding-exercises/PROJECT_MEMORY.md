# Web Design Coding Exercises Plugin Memory

This file is for web-design-coding-exercises-specific memory only.

## Long-Term Plugin Decisions

- This plugin is separate from `coding-exercise` because HTML/CSS/JS exercises need visual preview and browser-based grading rather than Judge0 stdin/stdout execution.
- Student-facing starter data lives in public `Activity.config`; private tests, teacher solution files, grading internals, and submission history should live in plugin-owned persistence.
- Students edit teacher-defined starter HTML/CSS/JS files in Monaco and preview their own result in a sandboxed iframe.
- Teacher solution files are private reference-bundle data, not public activity config. The teacher authoring UI may preview the solution, but students must not see the solution bundle.
- Web-design bank activities store reusable private reference bundles/tests in bank-owned plugin tables. When the bank activity is copied into a course, the plugin server hook copies that private bundle/tests into course-owned plugin tables so course and bank edits diverge safely.
- Teacher authoring is organized into top-level tabs: Setup, Solution, Student starting files, and Tests. Solution files and student starting files keep their own nested file tabs. Adding or removing a solution file should add or remove the matching student starter file; starter files may be marked read-only for students.
- Teacher Playwright tests should use the same compact pattern as the coding-exercise plugin: separate sample/hidden sections, collapsible test rows, icon-only actions, and pass/fail/skipped validation badges from the last reference-solution validation.
- When reference validation fails during test save, the API should return per-test validation details. The UI should update failed rows inline and keep the snackbar short, e.g. only saying how many tests failed.
- If a prompt contains `{{ EXPECTED_RESULT }}`, saving tests and solution should generate a full Playwright screenshot of the private solution bundle and store only the image artifact in reference metadata. `{{ EXPECTED_RESULT_CROPPED }}` does the same but asks the runner to trim large plain background regions while preserving padding around visible content. Student prompt rendering may replace either token with this screenshot, but must never receive solution source files.
- Browser preview should be client-side and sandboxed for fast feedback, with `allow-scripts` and `allow-modals` so student code can use JavaScript and modal APIs such as `alert()`.
- The student preview should expose a plugin-local console panel fed by an iframe `postMessage` bridge rather than relying on the browser developer console.
- Preview JavaScript should be loaded as Blob-backed script resources mapped back to original file paths so runtime errors can show useful file/line/column information when the browser provides it.
- Event listener callbacks inside the preview iframe should be wrapped by the preview bridge so handler exceptions are caught before they degrade into generic sandboxed `Script error.` messages.
- Student coding should offer a full-screen/focus mode that shows only file tabs, editor, preview, console, and an exit control to avoid nested page/editor scrolling during focused work.
- Graded submission should run through a Cognelo server route backed by an external Playwright runner service, not inside the web app or directly in the browser.
- The external Playwright runner should run through Docker Compose using the official Playwright image, so browser binaries and OS dependencies are container-managed.
- Playwright tests must stay teacher/admin-only and should be validated against the teacher reference solution before being saved.
- Saving teacher tests is runner-dependent: all enabled sample and hidden tests are executed against the teacher reference bundle before persistence; failing validation rejects the save and leaves existing tests unchanged.
- Plugin route behavior must stay inside the plugin package. The API app should expose only generic plugin dispatchers for course, section/group assigned, and activity-bank contexts.

## Current Implementation Slice

- Current implementation provides public config parsing for student starter files, activity registration, bank and course authoring support, tabbed solution/starter authoring UI, separate collapsible sample/hidden Playwright test authoring with validation badges and inline failure cards, expected-result screenshot generation for `{{ EXPECTED_RESULT }}` and cropped screenshot generation for `{{ EXPECTED_RESULT_CROPPED }}`, student file editing, sandboxed iframe preview, preview console capture, modal support, improved runtime error reporting, student full-screen/focus mode, and plugin-owned persistence tables for bank reference bundles/tests, course reference bundles/tests, submissions, and per-test results.
- Teacher/admin test management uses the plugin route `web-design-coding-exercises/tests` to persist a private reference file bundle plus sample/hidden Playwright test code. The same plugin route path works in course context and activity-bank context through generic API dispatchers.
- `copyBankWebDesignExerciseTestsToCourseActivity` is invoked through the server plugin hook when a bank web-design activity version becomes a course activity copy.
- Student run/submit routes use the Docker-backed `packages/web-design-runner` service through `WEB_DESIGN_RUNNER_URL`; sample tests are used for run and hidden tests are used for submit.
- Reference validation executes enabled teacher tests against the reference bundle before saving and stores per-test validation summaries for passed or skipped tests.

## Planned Next Modules

- Harden the Docker Playwright runner for production deployment with stricter resource constraints, no secrets in the runner, and constrained network access.
- Add result history and teacher-facing review surfaces for submissions, test failures, and future research/analytics data.
