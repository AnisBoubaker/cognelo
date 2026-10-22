# Plugin: Web Design Coding Exercises

`@cognelo/plugin-web-design-coding-exercises` provides the `web-design-coding-exercise` activity type. Learners edit teacher-defined HTML/CSS/JavaScript starter files, preview them in a sandboxed iframe, and run or submit them against Playwright tests through an external runner.

Teacher review routes consume core grade capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs can inspect and grade only assigned sections. Test mutation, authoring, and grade release remain course-management operations.

Teachers can [reopen the last submission](../../../docs/SUBMISSION_CONTINUATION.md) so its saved answers can be continued using the original start and current effective settings.

Compound Test submission includes a final answer review with plugin-owned response checks; it reports whether work was answered without revealing correctness. See the [detailed reference](docs/REFERENCE.md).

Live course-question edits preserve active responses and use the shared warning/audit workflow; summative outcomes remain hidden until grade release. See [Live authoring and grade visibility](docs/REFERENCE.md#live-authoring-and-grade-visibility).

Teachers can opt into the shared [Solution tab](../../../docs/ACTIVITY_SOLUTIONS.md) in course-content settings. Students explicitly reveal it; summative work also requires released grades. A compound Test uses its parent switch.

Deleted submissions display retained student files and the teacher’s reason through the [shared history flow](../../../docs/GRADEBOOK_IMPLEMENTATION_PLAN.md#submission-deletion).

## Read By Topic

- [Shared team and student assignment exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md)

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
- Editor assets and HTML/CSS/JavaScript workers use the shared first-party [Monaco loader](../../../docs/reference/PLATFORM_DECISIONS.md#frontend-platform-decisions), including when staff inspect expired assignments.
- The definition declares interactive, plugin-executed Student view support and uses that learner UI plus stateless runner evaluation; it never writes submission, test-result, attempt, grade, or analytics rows.
- Administrators configure the endpoint under **Settings → Runners**. Core persists the endpoint and optional encrypted authentication token and resolves it through the pool-ready runner selector.
- Enabled tests must pass against the private reference bundle before they are saved.
- Bank/course private data is copied, synchronized, duplicated, and deleted through explicit plugin hooks.
- Reusable bank Tests invoke those hooks for every independently owned web-design child across bank copy, course import/publication, duplication, and deletion.
- Every standalone submission creates a mode-tagged core attempt. The shared teacher inspector can navigate submitted HTML/CSS/JavaScript bundles from either mode; grade overrides are available only for summative attempts. Automatic regrading is not advertised because the plugin has no current-answer regrading handler.
- Course assignment settings may time the standalone learner workspace. Core owns start/deadline enforcement and live settings refresh until submission; drafts and practice runs stop at expiry, and the renderer invokes the ordinary hidden Playwright submission at zero.
- When the effective summative assignment setting enables challenges, released automatic or teacher-overridden grades are challengeable through core and reopen that same **Review and grade** workflow.
- Activity-bank variations preserve the selected concepts, skills, and misconceptions, file topology, test count/order/kinds/weights, technologies, and difficulty while generating a new prompt, student starter bundle, private solution bundle, and Playwright tests. The ordinary private reference validation and expected-result screenshot path run before completion.
- Playwright-backed learner runs/submissions and teacher saves that validate tests or capture expected-result screenshots use the platform shared blocking, indeterminate progress dialog. Variation uses the host job's real progress.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.

Expired compound Test responses can be [recovered from teacher results](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) without running a grader. The teacher’s automatic-grading action reruns every child of a submitted Test against current grading rules, with measured progress for individual and whole-class batches. See [Test regrading](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading).

The shared [activity content closure setting](../../../docs/ACTIVITY_CONTENT_ACCESS.md) can restrict student access after effective attempts or closing dates end. The host then shows only receipts and released grade totals; staff records remain available.

Saved code loads as a fresh [editor baseline](../../../docs/EDITOR_UNDO.md). Test question/file undo histories remain separate in memory while the Test is open; reload or reopening starts from the saved answer. Normal edits, undo, and redo continue to autosave.
