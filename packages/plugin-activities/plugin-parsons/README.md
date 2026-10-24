# Plugin: Parsons

`@cognelo/plugin-parsons` provides the `parsons-problem` activity type. Teachers define a prompt, reference solution, line groups, indentation behavior, and precedence rules. Learners reconstruct the program with keyboard- and pointer-accessible controls.

Gradebook attempt review and grading use core grade scope, so explicit course teachers/admins work course-wide while section teachers/TAs are limited to assigned sections; authoring and release remain course-management operations.

Teachers can [reopen the last submission](../../../docs/SUBMISSION_CONTINUATION.md) so its saved answers can be continued using the original start and current effective settings.

Compound Test submission includes a final answer review with plugin-owned response checks; it reports whether work was answered without revealing correctness. See the [detailed reference](docs/REFERENCE.md).

Live course-question edits preserve active responses and use the shared warning/audit workflow; summative outcomes remain hidden until grade release. See [Live authoring and grade visibility](docs/REFERENCE.md#live-authoring-and-grade-visibility).

Teachers can opt into the shared [Solution tab](../../../docs/ACTIVITY_SOLUTIONS.md) in course-content settings. Students explicitly reveal it; summative work also requires released grades. A compound Test uses its parent switch.

Previous submissions can be inspected before starting another timed attempt through the [shared history flow](../../../docs/GRADEBOOK_IMPLEMENTATION_PLAN.md#submission-deletion).

## Read By Topic

- [Shared team and student assignment exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md)

- [Authoring config, persistence, and routes](docs/REFERENCE.md#persistence)
- [Generation and grading behavior](docs/REFERENCE.md#routes)
- [Learner and authoring UX](docs/REFERENCE.md#ux-notes)
- [Detailed decisions](docs/DECISIONS.md)

## Boundaries

- Authored Parsons data is generic activity config, so core owns bank copying, synchronization, and version comparison.
- Reusable bank Tests copy Parsons children into Test-owned bank activities and later into independent course children; learner attempt/event rows are never copied.
- Student state and event history use plugin-owned `PluginParsonsAttempt` and `PluginParsonsAttemptEvent` tables.
- Teacher/admin previews are ephemeral and must not pollute learner research data.
- The definition declares interactive, plugin-executed Student view support. Standalone preview state and checks remain browser-scoped; stateless server actions provide the same deterministic, non-persistent evaluation when Parsons is embedded in a preview Test.
- Formative checks and summative submissions create mode-tagged core attempts linked to the richer plugin attempt. Only summative attempts are graded, suppress correctness until release, and support teacher regrades; formative checks remain read-only teacher evidence.
- Course assignment settings may time Parsons in either mode. Core owns start/deadline enforcement and live settings refresh until submission; at zero the renderer submits the current persisted arrangement through the ordinary final check/submission path.
- Teacher review can resolve one exact linked Parsons attempt. The shared report dialog loads the newest current-mode submission first, then fetches older attempts only when navigated to; historical attempts are read-only.
- When the effective summative assignment setting enables challenges, the released deterministic or teacher-overridden grade is challengeable through the core workflow and returns to the existing Parsons **Review and grade** surface.
- Activity-bank variations preserve the selected concepts, skills, and misconceptions, language, grouping/precedence structure, line count, and difficulty while generating a meaningfully different prompt and reference solution. The copied activity is independent, including inside reusable Test variations.
- AI prompt/solution generation uses the platform shared blocking, indeterminate progress dialog; reusable Test variation progress remains owned by the activity-bank background job.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.

Expired compound Test responses can be [recovered from teacher results](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) without running a grader. The teacher’s automatic-grading action reruns every child of a submitted Test against current grading rules, with measured progress for individual and whole-class batches. See [Test regrading](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading).

Displayed submission and review timestamps use the shared [effective course timezone (application default unless overridden)](../../../docs/APPLICATION_TIME.md).

The shared [activity content closure setting](../../../docs/ACTIVITY_CONTENT_ACCESS.md) can restrict student access after effective attempts or closing dates end. The host then shows only receipts and released grade totals; staff records remain available.

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Teachers can [export submitted answers as PDF or ZIP](../../../docs/ANSWER_EXPORTS.md), including selectable prompts and grading content. See [export details](docs/REFERENCE.md#answer-exports).
