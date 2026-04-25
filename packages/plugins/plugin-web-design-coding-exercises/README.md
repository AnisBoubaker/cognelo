# Plugin: Web Design Coding Exercises

This README is for the web-design-coding-exercises plugin only.

It documents plugin-specific architecture, browser preview boundaries, and planned Playwright grading. Platform-wide architecture belongs in the root [README.md](../../../README.md).

## Purpose

`@cognelo/plugin-web-design-coding-exercises` provides the `web-design-coding-exercise` activity type.

Teachers can define a small HTML/CSS/JavaScript file bundle for students to edit. Students work in Monaco editor tabs and see the result immediately in a sandboxed iframe.

## Package Contents

```text
src/
  db.ts                         Plugin DB manifest
  index.ts                      Public plugin exports
  plugin.ts                     Activity plugin definition
  server.ts                     Server plugin registration
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

The initial implementation keeps only student-visible fields in `Activity.config`:

- `prompt`
- `files`
- `previewEntry`
- `maxEditorSeconds`

Planned plugin-owned persistence:

- teacher reference file bundle
- hidden Playwright tests
- submission history and normalized test results

## Planned Playwright Grading

The intended submit flow is:

1. web UI calls a Cognelo plugin route
2. plugin route authenticates the user and loads the activity
3. plugin service stores a pending submission
4. Cognelo sends the submitted file bundle and enabled tests to an external Playwright runner
5. the runner renders the submitted page in an isolated browser context
6. the runner returns normalized test results
7. Cognelo stores filtered results and returns them to the browser

The browser should never receive hidden tests or private reference files.

## Contributor Workflow

When changing this plugin, update:

- `packages/plugins/plugin-web-design-coding-exercises/README.md`
- `packages/plugins/plugin-web-design-coding-exercises/PROJECT_MEMORY.md`

Only update the root `README.md` or `docs/PROJECT_MEMORY.md` if the change affects the whole platform or a cross-plugin convention.
