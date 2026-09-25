# Plugin: Web Design Coding Exercises

`@cognelo/plugin-web-design-coding-exercises` provides the `web-design-coding-exercise` activity type. Learners edit teacher-defined HTML/CSS/JavaScript starter files, preview them in a sandboxed iframe, and run or submit them against Playwright tests through an external runner.

## Read By Topic

- [Public/private data and bank/course lifecycle](docs/REFERENCE.md#architecture-boundary)
- [Teacher authoring](docs/REFERENCE.md#authoring-ux)
- [Playwright validation and submission flow](docs/REFERENCE.md#playwright-grading)
- [Runner setup](docs/REFERENCE.md#docker-runner)
- [Detailed decisions](docs/DECISIONS.md)

## Boundaries

- Public config contains only student starter files, prompt, preview entry, and editor settings.
- Teacher solution bundles, Playwright tests, screenshots, submissions, and results use plugin-owned persistence.
- Fast preview is client-side and sandboxed; graded execution is server-mediated through the external runner.
- Enabled tests must pass against the private reference bundle before they are saved.
- Bank/course private data is copied, synchronized, duplicated, and deleted through explicit plugin hooks.
- Reusable bank Tests invoke those hooks for every independently owned web-design child across bank copy, course import/publication, duplication, and deletion.
- The shared **Review and grade** workflow loads the latest submitted HTML/CSS/JavaScript files through the plugin's teacher-authorized review route and permits an audited final-grade override. Automatic regrading is not advertised because the plugin has no current-answer regrading handler.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
