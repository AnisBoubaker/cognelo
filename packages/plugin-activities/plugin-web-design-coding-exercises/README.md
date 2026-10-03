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
- Teacher test removal uses the platform shared confirmation dialog; native modal APIs remain limited to learner-authored code inside the sandboxed preview.
- Fast preview is client-side and sandboxed; graded execution is server-mediated through the external runner.
- Administrators configure the endpoint under **Settings → Runners**. Core persists the endpoint and optional encrypted authentication token and resolves it through the pool-ready runner selector.
- Enabled tests must pass against the private reference bundle before they are saved.
- Bank/course private data is copied, synchronized, duplicated, and deleted through explicit plugin hooks.
- Reusable bank Tests invoke those hooks for every independently owned web-design child across bank copy, course import/publication, duplication, and deletion.
- Every standalone submission creates a mode-tagged core attempt. The shared teacher inspector can navigate submitted HTML/CSS/JavaScript bundles from either mode; grade overrides are available only for summative attempts. Automatic regrading is not advertised because the plugin has no current-answer regrading handler.
- Released automatic or teacher-overridden grades are challengeable through core and reopen that same **Review and grade** workflow.
- Activity-bank variations preserve the selected concepts, skills, and misconceptions, file topology, test count/order/kinds/weights, technologies, and difficulty while generating a new prompt, student starter bundle, private solution bundle, and Playwright tests. The ordinary private reference validation and expected-result screenshot path run before completion.
- Playwright-backed learner runs/submissions and teacher saves that validate tests or capture expected-result screenshots use the platform shared blocking, indeterminate progress dialog. Variation uses the host job's real progress.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
