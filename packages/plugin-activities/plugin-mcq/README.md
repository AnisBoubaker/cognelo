# Plugin: MCQ

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity. Teachers author one portable Markdown-like source document; learners receive accessible choice controls and deterministic answer-key grading.

Gradebook attempt review and grading use core grade scope, so explicit course teachers/admins work course-wide while section teachers/TAs are limited to assigned sections; authoring and release remain course-management operations.

Teachers can [reopen the last submission](../../../docs/SUBMISSION_CONTINUATION.md) so its saved answers can be continued using the original start and current effective settings.

Compound Test submission includes a final answer review with plugin-owned response checks; it reports whether work was answered without revealing correctness. See the [detailed reference](docs/REFERENCE.md).

Live course-question edits preserve active responses and use the shared warning/audit workflow; summative outcomes remain hidden until grade release. See [Live authoring and grade visibility](docs/REFERENCE.md#live-authoring-and-grade-visibility).

Teachers can opt into the shared [Solution tab](../../../docs/ACTIVITY_SOLUTIONS.md) in course-content settings. Students explicitly reveal it; summative work also requires released grades. A compound Test uses its parent switch.

Previous submissions can be inspected before starting another timed attempt; the [shared history flow](../../../docs/GRADEBOOK_IMPLEMENTATION_PLAN.md#submission-deletion) is read-only.

Learner responses use an explicit public projection; see [learner data boundaries](docs/REFERENCE.md#learner-data-boundaries).

## Read By Topic

- [Shared team and student assignment exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md)

- [Source grammar and authoring model](docs/REFERENCE.md#authoring-model)
- [Attempts, drafts, compound Tests, and current behavior](docs/REFERENCE.md#current-state)
- [Assessment feedback](docs/REFERENCE.md#ai-assessment-feedback)
- [Detailed decisions](docs/DECISIONS.md)

## Core Behavior

- `##` starts a question; `- [x]` and `- [ ]` mark correct and incorrect choices.
- `#` and `---` create titled and untitled content sections between questions.
- Question prompts and choices render Markdown images, including web URLs, and portable GFM tables in addition to text, math, lists, and fenced code.
- Authored content is generic activity config, so core owns bank copying, synchronization, and version comparison.
- Immutable AI evaluation artifacts use the plugin-local MCQ Prisma schema/client; the core Prisma client does not model this table.
- Reusable bank Tests copy MCQ children into Test-owned bank activities and later into independent course children without plugin-private authoring rows.
- Standalone answers autosave through `ActivityResponseDraft`; compound Test answers use `TestItemAttempt`.
- Course assignment settings may time a standalone MCQ in either assessment mode. Core owns the explicit start, live deadline capped by the effective Until date, and countdown; at zero the renderer invokes the ordinary check/submission path so deterministic grading and draft cleanup remain unchanged.
- Formative **Check answers** and summative submissions both create mode-tagged core attempts. Only summative attempts use limits, gradebook selection, grading, and release visibility; teachers can inspect formative attempts and their exact generated feedback read-only.
- Teacher review resolves an exact core MCQ attempt. The report dialog loads only the newest current-mode submission initially and requests older submissions as the teacher navigates; historical and formative attempts remain read-only.
- Ordinary **Formative** never invokes or exposes model feedback. **Formative with automatic AI feedback** may generate feedback for the exact attempt when the plugin/course AI prerequisites are satisfied, persists it with that attempt, and shows it in the learner's **Previous submissions** history.
- Optional model feedback can explain results but never changes deterministic MCQ grades and is not independently challengeable. The released deterministic grade and teacher-authored released feedback remain challengeable through the core workflow when the effective summative assignment setting permits it.
- Activity-bank variations preserve the selected concepts, skills, and misconceptions, question count, code-language setting, and difficulty while generating a new student introduction, questions, choices, and independently audited answer key. Reusable Test variation applies the same operation to each MCQ child.
- The definition declares interactive, plugin-executed Student view support; the learner questionnaire uses browser-scoped answers and deterministic, non-persistent checking.
- AI question generation and automatic formative model feedback use the shared blocking, indeterminate progress dialog; variation progress is supplied by the activity-bank background job.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.

Expired compound Test responses can be [recovered from teacher results](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) without running a grader. The teacher’s automatic-grading action reruns every child of a submitted Test against current grading rules, with measured progress for individual and whole-class batches. See [Test regrading](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading).

Displayed submission and review timestamps use the shared [effective course timezone (application default unless overridden)](../../../docs/APPLICATION_TIME.md).

The shared [activity content closure setting](../../../docs/ACTIVITY_CONTENT_ACCESS.md) can restrict student access after effective attempts or closing dates end. The host then shows only receipts and released grade totals; staff records remain available.

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Teachers can [export submitted answers as PDF or ZIP](../../../docs/ANSWER_EXPORTS.md), including selectable prompts and grading content. See [export details](docs/REFERENCE.md#answer-exports).

Timed finalization uses only server-saved work after expiry; see [deadline enforcement](docs/REFERENCE.md#deadline-finalization).

Submitted answers are constrained to authored questions and choices before grading or persistence. See [learner data boundaries](docs/REFERENCE.md#learner-data-boundaries).
