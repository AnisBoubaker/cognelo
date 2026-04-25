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
- Playwright tests must stay teacher/admin-only and should be validated against the teacher reference solution before being saved.

## Current Implementation Slice

- Current implementation provides public config parsing, activity registration, authoring UI, student file editing, sandboxed iframe preview, preview console capture, modal support, improved runtime error reporting, and student full-screen/focus mode.

## Planned Next Modules

- Add plugin-owned Prisma tables for teacher reference file bundles, hidden Playwright tests, and student submissions/results.
- Add teacher-only test management routes and UI for visible/sample tests and hidden graded tests.
- Add reference-solution validation so enabled hidden Playwright tests must pass against the teacher reference bundle before being saved.
- Add an external Playwright runner service for local Docker development and production deployment, with strict timeouts, no secrets in the runner, and constrained network/resource access.
- Add student run/submit routes that store pending and completed submissions server-side and return filtered results to the browser.
- Add result history and teacher-facing review surfaces for submissions, test failures, and future research/analytics data.
