# Web Design Coding Exercises Plugin Memory

This file is for web-design-coding-exercises-specific memory only.

## Long-Term Plugin Decisions

- This plugin is separate from `coding-exercise` because HTML/CSS/JS exercises need visual preview and browser-based grading rather than Judge0 stdin/stdout execution.
- Student-facing authoring data lives in public `Activity.config`; private tests, reference solutions, grading internals, and submission history should live in plugin-owned persistence.
- Students edit teacher-defined HTML/CSS/JS files in Monaco and preview the result in a sandboxed iframe.
- Browser preview should be client-side and sandboxed for fast feedback.
- Graded submission should run through a Cognelo server route backed by an external Playwright runner service, not inside the web app or directly in the browser.
- Playwright tests must stay teacher/admin-only and should be validated against the teacher reference solution before being saved.

## Current Implementation Slice

- Initial implementation provides public config parsing, activity registration, authoring UI, student file editing, and sandboxed iframe preview.
- Submission persistence, hidden Playwright tests, reference solution storage, and runner service integration are planned next modules.
