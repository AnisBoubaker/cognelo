# Plugin: Programming Exercises

`@cognelo/plugin-coding-exercises` provides the `coding-exercise` activity type. Teachers author prompts, starter/template code, reference solutions, visible and hidden tests, rubrics, and optional automatic feedback. Learners write and run code in Monaco, submit against hidden tests through Judge0, resume drafts, and review prior submissions.

Student and teacher code surfaces opt out of browser translation and writing assistance, including the Monaco fallback and code embedded in rendered Markdown instructions. Ordinary instructional prose remains eligible for translation.

Student template protection omits whitespace-only hidden boundaries, keeps the cursor within the live editable region, and lets select-all clear the student answer without removing protected scaffold code.

New exercises inherit the owning Subject's optional default programming language when they are created in a course, activity bank, course Test, or reusable bank Test. The choices come from the programming languages exposed by the configured Judge0 instance. A Subject can declare multiple languages; both that value and a missing default leave the exercise at `--- Choose ---`. Saving, generation, validation, execution, and submission remain unavailable until the exercise has one language. Existing and copied exercises keep their saved language.

AI test generation warns before replacing an existing suite, then asks for visible and hidden counts (3 and 8 by default, at most 15 each), produces **Contains lines** comparisons with concise descriptive names capped at 50 characters and non-empty expected output, and validates the complete suite against the reviewed reference solution before inserting it into the authoring form. Invalid assertion-only harnesses are returned to the generation correction loop before Judge0 instead of surfacing an output-matcher error to the teacher.

From an activity bank, **Create variation** makes an independent draft with the same concept, skill, and misconception selections, programming language, difficulty, exact visible/hidden test counts, hidden-test weights, and deep-copied rubric. It then generates a matching title and description plus a meaningfully different prompt, solution/template, and test suite, and validates the suite through Judge0. A second count check at the save boundary prevents any mismatched suite from being persisted. Test retries retain the complete immutable exercise context; if the generated solution/template cannot support the required independent cases, the variation replaces that solution/template and retries once. The rubric is intentionally not regenerated: it starts identical but belongs to the new activity, so later rubric edits never affect the source.

On later saves, reference validation reuses fingerprinted passing results and sends only new, changed, or previously failing tests to Judge0. A short-lived signed preflight receipt carries that server-validated result into persistence without executing dirty tests twice; any failure still blocks the save.

Teacher **Rerun automatic grading** reruns current hidden tests without invoking AI; **Assess with AI** evaluates the current rubric and generates feedback from the latest saved test result without rerunning tests. Both recompute the grade using current component weights. **Review and grade** then presents the submitted code, test evidence, rubric scores with each criterion's configured weight, three feedback fields, a one-row live breakdown of the automatic-tests grade, rubric grade, and total, plus an editable final grade in one place. A confirmed **Clear feedback content** action removes all learner-facing narrative from the draft while preserving rubric/test scores, so selected learners can receive newly written manual feedback without changing their grades. Released final grades and separately identified generated or teacher-authored feedback can be challenged. The same shared dialog opens in place from a course challenge; teachers may revise challenged feedback because core preserves the original immutable snapshot/hash and audits the linked before/after revision and any grade change.

When rubric grading is configured, a tests-only score is marked **Partial** in the detailed gradebook until the rubric component is graded. Programming Exercises report that component state through the server plugin contract, and the host prevents release while any submitted learner is partial or ungraded. A teacher final-grade override completes the grade; learners who did not submit do not block release.

Every successful standalone code submission creates a core attempt tagged with the assignment mode. Formative attempts are inspectable and may receive immediate feedback, but never consume summative limits or enter the grade. Summative reports resolve plugin executions only through summative core references, so old formative work remains available without polluting later summative results.

After release, the learner's grading report presents the available automatic-test and rubric point contributions plus the final total, every graded code attempt, teacher comments, criterion scores and explanations, and each test's pass/fail outcome and weighted score. Components that do not contribute to the configured grade are omitted from the recap. The report is built by a release-gated plugin handler and never includes hidden inputs, expected outputs, private rubric instructions, or raw model artifacts.

## Boundaries

- `Activity.config` contains only student-safe prompt, language, starter/template projection, visible tests, and editor settings.
- Reference solutions, hidden scaffolds/tests, rubrics, evaluations, and execution history use plugin-owned persistence.
- Browsers call Cognelo plugin routes; only the server communicates with Judge0.
- Administrators configure Judge0 under **Settings → Runners**. Its endpoint and encrypted token live in the core runner registry rather than application environment variables; the plugin resolves a runner through the pool-ready core selector for every request.
- Execution output is bounded before persistence and in browser-facing responses; grading still uses the complete Judge0 result.
- Course and bank copies have independent private rows connected by explicit lifecycle hooks.
- Reusable bank Tests invoke those same hooks for each Test-owned child during bank copy, course import, course publication, duplication, and deletion.

## Read By Topic

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
