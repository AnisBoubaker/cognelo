# Plugin: Programming Exercises

`@cognelo/plugin-coding-exercises` provides the `coding-exercise` activity type. Teachers author prompts, starter/template code, reference solutions, visible and hidden tests, rubrics, and optional automatic feedback. Learners write and run code in Monaco, submit against hidden tests through Judge0, resume drafts, and review prior submissions.

Student and teacher code surfaces opt out of browser translation and writing assistance, including the Monaco fallback and code embedded in rendered Markdown instructions. Ordinary instructional prose remains eligible for translation.

Student template protection omits whitespace-only hidden boundaries, keeps the cursor within the live editable region, and lets select-all clear the student answer without removing protected scaffold code.

New exercises inherit the owning Subject's optional default programming language when they are created in a course, activity bank, course Test, or reusable bank Test. The choices come from the programming languages exposed by the configured Judge0 instance. A Subject can declare multiple languages; both that value and a missing default leave the exercise at `--- Choose ---`. Saving, generation, validation, execution, and submission remain unavailable until the exercise has one language. Existing and copied exercises keep their saved language.

AI test generation warns before replacing an existing suite, then asks for visible and hidden counts (3 and 8 by default, at most 15 each), produces **Contains lines** comparisons with concise descriptive names capped at 50 characters, and validates the complete suite against the reviewed reference solution before inserting it into the authoring form.

On later saves, reference validation reuses fingerprinted passing results and sends only new, changed, or previously failing tests to Judge0. A short-lived signed preflight receipt carries that server-validated result into persistence without executing dirty tests twice; any failure still blocks the save.

Teacher **Rerun automatic grading** reruns current hidden tests without invoking AI; **Assess with AI** evaluates the current rubric and generates feedback from the latest saved test result without rerunning tests. Both recompute the grade using current component weights. **Review and grade** then presents the submitted code, test evidence, rubric scores with each criterion's configured weight, three feedback fields, a one-row live breakdown of the automatic-tests grade, rubric grade, and total, plus an editable final grade in one place.

## Boundaries

- `Activity.config` contains only student-safe prompt, language, starter/template projection, visible tests, and editor settings.
- Reference solutions, hidden scaffolds/tests, rubrics, evaluations, and execution history use plugin-owned persistence.
- Browsers call Cognelo plugin routes; only the server communicates with Judge0.
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
src/hidden-tests.ts       private test management
src/judge0.ts             server-side Judge0 client
src/web/                  authoring, learner, and feedback UI
prisma/                   plugin schema and migrations
```

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section.
