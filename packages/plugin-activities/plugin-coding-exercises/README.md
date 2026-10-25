# Plugin: Programming Exercises

`@cognelo/plugin-coding-exercises` provides the `coding-exercise` activity type. Teachers author prompts, starter/template code, reference solutions, visible and hidden tests, rubrics, and optional automatic feedback. Learners write and run code in Monaco, submit against hidden tests through Judge0, resume drafts, and review prior submissions.

Course and section links open the same teacher activity-report workspace. Its **Edit activity** action opens the shared **Activity / Concepts / Grading** authoring tabs; **Settings** opens the same assignment-settings modal as course content. Rubric and test-case controls stay within Grading.

Teacher review routes consume core grade capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs can inspect and grade only assigned sections. Authoring, hidden-test mutation, grade release, and persisted activity-wide AI-instruction changes remain course-management operations.

Student and teacher code surfaces opt out of browser translation and writing assistance, including the Monaco fallback and code embedded in rendered Markdown instructions. Ordinary instructional prose remains eligible for translation. The shared [Monaco loader](../../../docs/reference/PLATFORM_DECISIONS.md#frontend-platform-decisions) uses absolute first-party asset URLs for its background language services.

Student template protection omits whitespace-only hidden boundaries, keeps the cursor within the live editable region, and lets select-all clear the student answer without removing protected scaffold code.

The current-run panel shows the latest execution, with a link beneath it to reveal or hide all earlier runs. Older runs start collapsed; a new run result collapses them again. The same presentation applies to standalone exercises and programming questions inside Tests. All execution records remain saved.

The learner test runner contains and wraps execution output even when a program emits a very long line without spaces, so output cannot widen the responsive editor/test layout or push the runner off-screen. Submission history is accessible before a timed start; deleted source remains visible with its reason in [retained history](../../../docs/GRADEBOOK_IMPLEMENTATION_PLAN.md#submission-deletion).

The activity definition declares interactive, plugin-executed Student view support. Teacher Student view reuses the learner editor and real Judge0 validation through stateless preview handlers. Preview source stays in browser session storage and no execution, attempt, grade, or analytics row is written.

New exercises inherit the owning Subject's optional default programming language when they are created in a course, activity bank, course Test, or reusable bank Test. The choices come from the programming languages exposed by the configured Judge0 instance. A Subject can declare multiple languages; both that value and a missing default leave the exercise at `--- Choose ---`. Saving, generation, validation, execution, and submission remain unavailable until the exercise has one language. Existing and copied exercises keep their saved language.

AI test generation asks whether to **Add to existing tests** (the default) or **Replace all tests**, then takes visible and hidden counts (3 and 8 by default, 0–15 each with at least one test in total). Add supplies the full current test cases to the AI for complementary coverage, preserves existing cases, and respects the exercise’s total limits; Replace clears a kind when its requested count is zero. It produces **Contains lines** comparisons with concise descriptive names capped at 50 characters and non-empty expected output, and validates each case against the reviewed reference solution. Passing cases are retained unchanged across correction attempts. If some cases still fail, the valid subset is inserted into the unsaved authoring form with a localized warning showing the retained/requested counts. If none pass, the existing draft stays unchanged. Invalid assertion-only harnesses enter the correction loop before Judge0 without preventing other valid cases from being checked.

From an activity bank, **Create variation** makes an independent draft with the same concept selections, programming language, difficulty, and copied rubric. It requires a substantive change to the problem and solution reasoning, with a separate AI review of novelty, curriculum alignment, and consistency (including numerical examples). Cosmetic or inconsistent candidates are regenerated before tests or saving. It then generates matching metadata, targets the original test counts, and keeps only tests that pass validation. Incomplete test generation no longer discards a reviewed exercise: the draft may contain fewer tests or none, and completion reports retained counts plus review guidance. Reusable Test variations use the same review for each programming child and collect warnings for incomplete tests. See [Authoring UX](docs/REFERENCE.md#authoring-ux) for retry and save behavior.

AI rubric generation first opens a guidance dialog. Optional teacher guidance is saved privately for the exercise when Generate is confirmed, prefilled on later visits, and retained after generation failures. It stays separate from grading instructions; generated criteria remain a draft until the exercise is saved.

On later saves, reference validation reuses fingerprinted passing results and sends only new, changed, or previously failing tests to Judge0. A short-lived signed preflight receipt carries that server-validated result into persistence without executing dirty tests twice; any failure still blocks the save.

Teacher **Rerun automatic grading** reruns current hidden tests without invoking AI; **Assess with AI** evaluates the current rubric and generates feedback from the latest saved test result without rerunning tests. Both recompute the grade using current component weights. **Review and grade** then presents the submitted code, test evidence, rubric scores with each criterion's configured weight, three feedback fields, a one-row live breakdown of the automatic-tests grade, rubric grade, and total, plus an editable final grade in one place. A confirmed **Clear feedback content** action removes all learner-facing narrative from the draft while preserving rubric/test scores, so selected learners can receive newly written manual feedback without changing their grades. When the effective summative assignment setting enables challenges, released final grades and separately identified generated or teacher-authored feedback can be challenged. The same shared dialog opens in place from a course challenge; teachers may revise challenged feedback because core preserves the original immutable snapshot/hash and audits the linked before/after revision and any grade change.

That shared dialog opens on the learner's newest submission in the assignment's current mode. Older submissions are loaded one at a time only when the teacher navigates to them and are inspection-only. Formative submissions use a dedicated read-only inspection path that shows submitted source, hidden-test outcomes, and any generated feedback tied to that exact attempt without calling a regrade endpoint.

Gradebook **Class overview** shows the private reference solution, per-test pass/fail aggregates, and every configured rubric criterion with its description, weight, current class average, and score-band distribution. Rubric aggregates prefer current gradebook feedback so teacher-authored or revised scores replace the original generated values; formative work without a grade falls back to the matching attempt's latest completed evaluation. Criteria without graded results remain visible.

Course assignment settings may time a standalone Programming Exercise in either assessment mode. Core owns the explicit start, live deadline, and countdown; practice runs and draft saves stop at expiry, while the renderer invokes the ordinary hidden-test submission at zero so the existing execution, feedback, and grading lifecycle is reused.

Before a whole-activity AI grading batch starts, the shared gradebook dialog loads the exercise's current AI instructions and lists graded attempts whose rubric explanations and narrative comments are populated. The teacher may select up to three as consistency examples; those examples are excluded from the remaining batch and their sanitized submissions plus reviewed feedback are supplied without learner identity. Edited instructions always guide that run, and the default-on persistence checkbox updates the exercise setting once before the batch. Every evaluation artifact snapshots the effective instructions and selected attempt references privately.

AI authoring, Judge0 run/submit, and saves that validate the reference solution use the platform blocking progress dialog. The bar is indeterminate for these single remote operations; activity-bank and gradebook batches provide their real job or item progress from the host.

When rubric grading is configured, a tests-only score is marked **Partial** in the detailed gradebook until the rubric component is graded. Programming Exercises report that component state through the server plugin contract, and the host prevents release while any submitted learner is partial or ungraded. A teacher final-grade override completes the grade; learners who did not submit do not block release.

Every successful standalone code submission creates a core attempt tagged formative or summative. Ordinary Formative never invokes or exposes model feedback. **Formative with automatic AI feedback** still creates a formative core attempt, but may generate attempt-specific feedback when the exercise and course AI prerequisites are enabled; that feedback is retained with the attempt and shown in **Previous submissions**. Formative attempts never consume summative limits or enter the grade. Summative reports resolve plugin executions only through summative core references, so old formative work remains available without polluting later summative results.

After release, the learner's grading report presents the available automatic-test and rubric point contributions plus the final total, every graded code attempt, teacher comments, criterion scores and explanations, and each test's pass/fail outcome and weighted score. Components that do not contribute to the configured grade are omitted from the recap. The report is built by a release-gated plugin handler and never includes hidden inputs, expected outputs, private rubric instructions, or raw model artifacts.

Teachers can opt into the shared [Solution tab](../../../docs/ACTIVITY_SOLUTIONS.md) in course-content settings. Students explicitly reveal it; summative work also requires released grades. A compound Test uses its parent switch.

## Boundaries

- `Activity.config` contains only student-safe prompt, language, starter/template projection, visible tests, and editor settings.
- Reference solutions, hidden scaffolds/tests, rubrics, evaluations, and execution history use plugin-owned persistence.
- Browsers call Cognelo plugin routes; only the server communicates with Judge0.
- Administrators configure Judge0 under **Settings → Runners**. Its endpoint and encrypted token live in the core runner registry rather than application environment variables; the plugin resolves a runner through the pool-ready core selector for every request.
- Execution output is bounded before persistence and in browser-facing responses; grading still uses the complete Judge0 result.
- Course and bank copies have independent private rows connected by explicit lifecycle hooks.
- Reusable bank Tests invoke those same hooks for each Test-owned child during bank copy, course import, course publication, duplication, and deletion.

Teachers can [reopen the last submission](../../../docs/SUBMISSION_CONTINUATION.md) so its saved answers can be continued using the original start and current effective settings.

Compound Test submission includes a final answer review with plugin-owned response checks; it reports whether work was answered without revealing correctness. See the [detailed reference](docs/REFERENCE.md).

Live course-question edits preserve active responses and use the shared warning/audit workflow; summative outcomes remain hidden until grade release. Exercises without enabled hidden tests still submit and await grading. See [Live authoring and grade visibility](docs/REFERENCE.md#live-authoring-and-grade-visibility).

Learner responses use an explicit public projection; see [learner data boundaries](docs/REFERENCE.md#learner-data-boundaries).

## Read By Topic

- [Shared submission deletion and retained student history](../../../docs/GRADEBOOK_IMPLEMENTATION_PLAN.md#submission-deletion)

- [Shared team and student assignment exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md)

- [Architecture boundary and private data](docs/REFERENCE.md#architecture-boundary)
- [Teacher authoring and generated exercises](docs/REFERENCE.md#authoring-ux)
- [Feedback, rubrics, grading, and research records](docs/REFERENCE.md#assessment-feedback-and-grading)
- [Judge0 execution and output comparison](docs/REFERENCE.md#judge0-integration)
- [Durable decisions and operational traps](docs/DECISIONS.md)
- [Platform AI-feedback contract](../../../docs/AI_FEEDBACK_GRADING_CHALLENGES_IMPLEMENTATION_PLAN.md)

Load only the topic relevant to the change.

## Key Files

```text
src/plugin.ts             activity definition and public config
src/routes.ts             plugin-owned HTTP routes
src/executions.ts         run and submission persistence
src/regrading.ts          teacher test-only grade composition
src/grade-completion.ts   gradebook component-completeness classification
src/hidden-tests.ts       private test management
src/judge0.ts             server-side Judge0 client
src/web/                  authoring, learner, and feedback UI
prisma/                   plugin schema and migrations
```

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.

Expired compound Test responses can be [recovered from teacher results](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) without running a grader. The teacher’s automatic-grading action reruns every child of a submitted Test against current grading rules, with measured progress for individual and whole-class batches. See [Test regrading](../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading).

Displayed submission and review timestamps use the shared [effective course timezone (application default unless overridden)](../../../docs/APPLICATION_TIME.md).

The shared [activity content closure setting](../../../docs/ACTIVITY_CONTENT_ACCESS.md) can restrict student access after effective attempts or closing dates end. The host then shows only receipts and released grade totals; staff records remain available.

Saved code loads as a fresh [editor baseline](../../../docs/EDITOR_UNDO.md). Test question/file undo histories remain separate in memory while the Test is open; reload or reopening starts from the saved answer. Normal edits, undo, and redo continue to autosave.

Interface actions use the shared [button style and semantic icons](../../../docs/ACTION_BUTTONS.md), including teacher and learner controls.

Teachers can [export submitted answers as PDF or ZIP](../../../docs/ANSWER_EXPORTS.md), including selectable prompts and grading content. See [export details](docs/REFERENCE.md#answer-exports).
