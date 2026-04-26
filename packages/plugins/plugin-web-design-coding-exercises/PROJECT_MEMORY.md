# Web Design Coding Exercises Plugin Memory

This file is for web-design-coding-exercises-specific memory only.

## Long-Term Plugin Decisions

- This plugin is separate from `coding-exercise` because HTML/CSS/JS exercises need visual preview and browser-based grading rather than Judge0 stdin/stdout execution.
- Student-facing authoring data lives in public `Activity.config`; private tests, reference solutions, grading internals, and submission history should live in plugin-owned persistence.
- Students edit teacher-defined HTML/CSS/JS files in Monaco and preview the result in a sandboxed iframe.
- Browser preview should be client-side and sandboxed for fast feedback, with `allow-scripts` and `allow-modals` so student code can use JavaScript and modal APIs such as `alert()`.
- The student preview should expose a plugin-local console panel fed by an iframe `postMessage` bridge rather than relying on the browser developer console.
- Preview JavaScript should be loaded as Blob-backed script resources mapped back to original file paths so runtime errors can show useful file/line/column information when the browser provides it.
- Event listener callbacks inside the preview iframe should be wrapped by the preview bridge so handler exceptions are caught before they degrade into generic sandboxed `Script error.` messages.
- Student coding should offer a full-screen/focus mode that shows only file tabs, editor, preview, console, and an exit control to avoid nested page/editor scrolling during focused work.
- Graded submission should run through a Cognelo server route backed by an external Playwright runner service, not inside the web app or directly in the browser.
- The external Playwright runner should run through Docker Compose using the official Playwright image, so browser binaries and OS dependencies are container-managed.
- Playwright tests must stay teacher/admin-only and should be validated against the teacher reference solution before being saved.
- Saving teacher tests is runner-dependent: all enabled sample and hidden tests are executed against the teacher reference bundle before persistence; failing validation rejects the save and leaves existing tests unchanged.

## Current Implementation Slice

- Current implementation provides public config parsing, activity registration, authoring UI, student file editing, sandboxed iframe preview, preview console capture, modal support, improved runtime error reporting, student full-screen/focus mode, and plugin-owned persistence tables for reference bundles, Playwright tests, submissions, and per-test results.
- Teacher/admin test management uses the plugin route `web-design-coding-exercises/tests` to persist a private reference file bundle plus sample/hidden Playwright test code.
- Student run/submit routes use the Docker-backed `packages/web-design-runner` service through `WEB_DESIGN_RUNNER_URL`; sample tests are used for run and hidden tests are used for submit.
- Reference validation executes enabled teacher tests against the reference bundle before saving and stores per-test validation summaries for passed or skipped tests.

## Planned Next Modules

- Harden the Docker Playwright runner for production deployment with stricter resource constraints, no secrets in the runner, and constrained network access.
- Add result history and teacher-facing review surfaces for submissions, test failures, and future research/analytics data.
