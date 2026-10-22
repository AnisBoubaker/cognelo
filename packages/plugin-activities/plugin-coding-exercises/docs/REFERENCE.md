# Programming Exercises Detailed Reference

This document is the detailed reference for the Programming Exercises plugin.

Platform-wide orientation belongs in the root [README.md](../../../../README.md).

## Purpose

The compound Test answer review uses `hasCodingExerciseAnswer` to compare nonempty saved student source against the same normalized, template-aligned starter used by the editor. Untouched or cleared source is unanswered; changed code counts without execution or correctness checks.

`@cognelo/plugin-coding-exercises` provides the `coding-exercise` activity type.

Teachers will be able to:

- write a programming prompt
- choose the learner language/runtime
- provide starter code and visible sample tests
- add optional per-test harness code for visible and hidden tests
- provide a template scaffold with a `{{ STUDENT_CODE }}` insertion marker, and optionally a `{{ TEST_CODE }}` insertion marker for per-test harness execution
- choose which scaffold lines remain visible to students while hidden blocks collapse to a language-appropriate `Hidden code` placeholder
- define hidden tests and grading rules
- run submissions against a remote Judge0 service

Students will be able to:

- read the prompt and write code in the shared Monaco editor
- run code against visible examples or with personalized input
- submit code for evaluation against hidden tests
- resume their work and review prior results

The learner workspace places the code editor and submission action in the left column and the test controls in the right column. It starts with a two-thirds/one-third split, exposes an accessible draggable divider that can also be resized with the keyboard, and collapses responsively on narrow screens. Students can elevate this same live workspace into a viewport-filling focus mode without losing editor contents, the selected test, output, or the current divider position; the exit control or Escape restores the inline view. In the two-column layout, the editor stretches to the full height of the test runner while the submission action remains directly below it. Monaco loads from Cognelo's first-party web assets rather than a runtime CDN so it works in restricted SEB sessions; if Monaco initialization still fails, the shared editor preserves the same controlled learner source and protected template boundaries in a plain-text fallback. Whitespace-only hidden template boundaries are omitted so a blank answer starts as one editable line, including for activities saved before this normalization. Cursor and selection clamping use Monaco's current model, allowing the first keystroke in an empty protected editor and limiting select-all deletion to the editable student region. The test selector wraps its selected label and uses the shared anchored-popover primitive so full test names remain readable even when the test column is narrow. Selecting a visible test displays its input, expected output, comparison mode, and ordering option as compact read-only information; its saved harness is applied server-side but is not shown to the learner. Selecting **Personalized test** preserves a separate editable custom input, hides expected-output and harness information, runs without an output assertion or sample harness, and shows the raw execution output without a pass/fail mark. Test-runner controls remain top-aligned in both modes, and only the output panel grows to consume unused vertical space. Grid and output containers have zero intrinsic minimum width, and unbroken execution text wraps within them, so a pathological stdout/stderr line cannot widen the workspace or move the runner beyond the viewport.

Preset-test and submission outcomes use only an accessible green checkmark or red cross. Judge0 lifecycle/status labels remain internal diagnostics rather than student-facing success text; pending executions retain a neutral pending label until an outcome exists, and personalized runs deliberately show no outcome mark because they do not compare output.

Standalone student source code autosaves through the core `ActivityResponseDraft` state host and is restored on reload. Every completed or failed submission clears that draft and resets the editor to the activity's starter code. Embedded Test coding exercises continue to use the Test execution host and its `TestItemAttempt` autosave queue. When a Test item has no saved source, its own configured starter code is displayed and persisted; Test navigation remounts the workspace so source and hidden-template placeholders cannot leak between questions.

Standalone Programming Exercises can be timed through the course assignment policy in either assessment mode. Core owns the explicit start gate, attempt-number reservation, live deadline, and countdown. Draft saves and learner run routes reject work after expiry; the declared final submit route may finish the active timed attempt. At zero the renderer uses `TimedActivityAutoSubmit` to call the same hidden-test submission function as the visible button, so Judge0 execution, plugin persistence, grading, feedback, and draft cleanup remain one path. The later plugin attempt reference is merged onto the already-started core attempt rather than consuming a second attempt.

Standalone learners use the host's **New attempt** and **Previous submissions** tabs once at least one submission exists. The host discovers core-backed history before a timed start, and opening history never initializes an empty answer draft. Executions referenced by deleted core attempts are omitted from normal history but remain stored; the Deleted submissions tab displays their retained `submittedSourceCode` snapshot and teacher reason, including for records deleted before this UI fix. The current attempt shows the prompt and only runs created after the latest submission. Run cards include the saved standard input as well as Judge0 output and diagnostics. The previous-submissions tab omits the prompt and lists submissions newest-first as accordions; expanding one shows the submitted source, its hidden-test result, every practice run made after the preceding submission and before that submission, and any automatic AI feedback recorded for that exact submission. Automatic feedback is returned there only while the effective assignment uses `formative_ai`; ordinary formative policy suppresses legacy feedback from the learner view. This timestamp projection also organizes execution history created before the attempt-history UI existed, so no execution-table migration is required. Submission opens a confirmation dialog after the result is recorded and moved to history. Every successful standalone group submission creates a core attempt tagged with its formative/summative mode. Only summative core attempts use assignment attempt limits and grading; unclassified legacy plugin executions do not consume a summative attempt.

## Package Contents

```text
src/
  coding-exercises.ts    Shared config parsing and runtime language helpers
  db.ts                  Plugin DB manifest
  executions.ts          Persistence and Judge0-backed run service
  hidden-tests.ts        Hidden-test persistence and teacher-only management
  index.ts               Public plugin exports
  judge0.ts              Shared Judge0 client for server-side plugin routes
  plugin.ts              Activity plugin definition and public config schema
  routes.ts              Plugin-owned run/history subroutes
  server.ts              Server plugin registration
  web/
    coding-exercise-activity-view.tsx
                          Plugin-owned authoring and learner UI
```

## Architecture Boundary

The coding-exercises plugin should keep a strict separation between:

- public activity config that is safe to send to students
- private plugin-owned grading data excluded from ordinary learner payloads; explicit solution release projects only reference source, never hidden tests, rubric instructions, or raw grading artifacts
- remote code execution through Judge0, always initiated by Cognelo server routes

The first implementation pass keeps only student-visible fields in `Activity.config`:

- `prompt`
- `language`
- `starterCode`
- `studentTemplateSource`
- `sampleTests`
- `maxEditorSeconds`

Private plugin-owned data stores:

- teacher reference solution
- hidden template scaffold
- visible line selections for the student-safe scaffold projection
- hidden test harness code and metadata

Current plugin-owned tables:

- `PluginCodingExerciseHiddenTest`
- `PluginCodingExerciseReferenceSolution`
- `PluginCodingExerciseExecution`
- `PluginBankCodingExerciseHiddenTest`
- `PluginBankCodingExerciseReferenceSolution`

These tables are modeled in this plugin's local Prisma schema under `prisma/schema.prisma`; plugin server code uses the plugin-local Prisma client from `src/db-client.ts`, not the core Prisma client.

Activity-bank authoring persists the same private reference solution, hidden template data, and tests in bank-owned plugin tables. When a bank activity is assigned to a course, the plugin hook copies that private data into course-owned plugin tables so future bank edits and course edits diverge safely.

Explicit course/bank synchronization replaces private authoring data through plugin hooks in either direction. Retrieval refreshes course-owned reference/test rows and is blocked after any attempt. Publishing refreshes bank-owned rows while core creates the new immutable generic version, and remains allowed after attempts because it does not change the attempted course copy.

Bank-version comparison currently shows public generic configuration but not private reference solutions, hidden templates, or hidden tests, because those bank-owned rows are not snapshotted per immutable activity version.

Generic versions are created only for changed Published saves. Draft saves update mutable public and private bank authoring without creating a version; private rows remain outside immutable snapshots.

Duplicating a coding exercise inside an activity bank invokes the platform bank-duplication hook and copies its bank-owned reference solution, complete private configuration (including rubric and automatic-feedback settings), and hidden tests to the new independent bank activity. Generating a replacement reference solution changes the solution and template fields while preserving that rubric configuration. Moving a bank activity keeps its ID, so its plugin-owned rows move with it without copying.

Reusable bank Tests use the same lifecycle at child granularity. Adding a coding exercise to a bank Test creates a new Test-owned bank activity and invokes bank duplication; importing that Test into a course invokes bank-to-course copying for the owned child; publishing a course Test invokes course-to-bank copying before the course graph is linked; and deleting or duplicating the Test dispatches the corresponding hook for every owned coding child.

## Authoring UX

The teacher authoring UI is a form surface and must stay registered with the shared `useUnsavedChangesGuard` hook from `@cognelo/activity-ui`. Any future coding-exercise authoring tabs or settings panels should do the same so navigation can offer continue editing, save and leave, or discard and leave.

At creation time, a Programming Exercise starts with the owning Subject's optional single programming-language default in course, bank, course-Test, and reusable-bank-Test contexts. Subject and exercise choices are the unique programming languages reported by the configured Judge0 instance; runtime versions and compiler variants collapse into a stable language key, while Python 2 and Python 3 remain distinct. A missing Subject value or the explicit multiple-languages value overlays an empty public `language` field and shows `--- Choose ---`. The authoring UI prevents saving until a language is chosen, while server validation rejects generation, test validation, execution, and submission without one. The creation layer never mutates registered defaults, rewrites existing activities, or replaces the saved language of copied activities.

The student-facing prompt is authored with the shared visual/Markdown `RichTextEditor` and remains stored as Markdown. Its Visual and Markdown bodies have the same fixed height, resize together from the bottom handle, scroll internally, and can each use the editor's far-right full-screen action. Its equation action opens the shared visual equation builder for mouse/touch construction and inline/display insertion; clicking a rendered formula reopens the builder for editing or removal. Visual mode preserves the original delimited Markdown, and complete formulas entered or pasted there also render after focus leaves. The table action inserts portable GFM tables from a size dialog, and selecting a cell exposes row and column insertion/removal controls; merging is omitted because standard GFM cannot represent spans. The image action uploads a PNG, JPEG, GIF, or WebP through the platform media service, requires alternative text, provides pixel/original-percentage/container-percentage sizing, and lets the author click an image to replace, edit, resize, or remove it. Bank versions, course copies, and Test snapshots retain their own logical references while identical physical bytes remain deduplicated. Learner current-attempt views render the prompt through the shared sanitized `MarkdownRenderer`, including headings, lists, emphasis, images, tables, fenced code, and KaTeX-compatible inline or `$$ ... $$` display math. Inline and fenced code is marked non-translatable while the surrounding prompt remains translatable. The shared Monaco/basic editors and code renderers use the same protection and disable browser writing assistance on editable code. Previous-submission views intentionally continue to omit the prompt.

When a teacher has selected an enabled question-authoring AI agent in global settings, the authoring UI can generate the student-facing prompt from the activity description, language, and subject context. Generation preserves required provided helpers/scaffolds in language-tagged Markdown code fences while withholding the full solution. Prompt correction attempts retain the complete original teacher brief, including variation constraints when applicable.

Prompt, solution, and test generation all use the shared knowledge-alignment choice. Every mode provides the complete subject catalog as a curriculum boundary. `Use selected skills` additionally adds the activity's current draft skills as specific constraints, `Suggest skills` replaces the unsaved host Concepts-tab draft with exact catalog skills inferred from the generated artifact, and `Ignore skills` neither reads nor changes that draft and performs no suggestion pass.

AI-assisted solution and test generation is intentionally staged:

1. Generate the reference solution and execution template. This clears starter code so the teacher can review the proposed answer before deciding what students should receive.
2. Generate visible and hidden test cases from the student instructions, reviewed reference solution, and template. Generated tests are validated server-side against Judge0 before they are inserted into the form.

Activity-bank variation uses those same validated stages as one background operation. Core first deep-copies generic and private authoring, including exact concept selections and the complete rubric-bearing private configuration. The variation brief carries the full source prompt and reference solution without truncating the algorithm, together with the unchanged rubric/policy. It requires a coherent new computation, state tracking, decomposition, or data-processing task at comparable difficulty. Paraphrases, renamed variables, changed constants, equivalent code, or moving the same algorithm to a new story are insufficient. Replacing only a condition, formula, or loop bound is also insufficient (for example, testing equal instead of consecutive values in the same fixed dice simulation); course-mandated helpers and shared boilerplate may remain unchanged.

Before generating metadata or tests, a separate call to the selected question-authoring agent compares the complete source and candidate prompts/solutions, teacher instructions, subject/knowledge context, and rubric. The structured review describes each algorithm, the concrete reasoning change, and independently derived numerical checks before giving its verdicts. Its adaptation classification must be `substantive`, not `surface_only` or `local_substitution`, and all three checks (novelty, preserved learning objectives/constraints, internal consistency) must pass without issues. It checks examples, implementation, units, and numerical claims; probability tasks require counting favourable/total outcomes rather than copying a source percentage. Identical prompts/solutions are rejected locally. Rejected candidates trigger regeneration of both prompt and solution with the review feedback, up to three candidates; exhaustion fails with `CODING_EXERCISE_VARIATION_QUALITY_FAILED` and the ordinary host graph compensation. Malformed review JSON gets one correction attempt with the complete context, then fails closed. Review remains AI-assisted, so the result is a teacher-reviewable draft, not a proof of semantic correctness. Private source/reference/rubric context is not returned in completion warnings or quality-failure details.

Once a candidate passes, the plugin generates matching metadata and targets the original visible/hidden counts. It retains passing cases through test correction attempts; a partial suite is saved without replacing its supporting solution. If no cases can be generated or validated because of a recoverable test-generation or compilation failure, variation retries once with a new solution/template and complete feedback/context. That replacement must pass the same quality review; a failed optional retry retains the earlier reviewed solution. If test generation still yields no usable cases, the latest reviewed exercise is saved without tests. A suite that merely repeats the original tests is also omitted. Copied source tests are always replaced, never used as a fallback for the changed exercise. Prompt/solution generation and unrelated provider, runner, or persistence failures still fail the job when no usable result is available.

The private save boundary still validates every retained case. Variation alone catches an ordinary reference-validation rejection, filters both kinds to explicitly passing IDs, and revalidates the smaller suite; every retry must remove at least one case. Infrastructure or malformed validation failures propagate. Final public config is saved with the same retained visible suite. Hidden cases initially receive the corresponding original positional weights; pruning never redistributes them, so teachers must review coverage and relative weights. The copied rubric and grading policy remain unchanged and independent.

When counts fall short, the handler returns a localized completion warning with retained/requested visible and hidden counts and instructions to review the reference solution, template, missing coverage, and hidden weights before publishing. Source exercises intentionally containing no tests do not trigger this warning. Warnings contain no raw model payloads or execution diagnostics. Reusable Test variation invokes this path for every Programming Exercise child and continues after a warning. The host persists warnings with the affected copy’s ID and final title in the successful job result, shows links and review guidance in the completion dialog, and records the same guidance in the shared warning notification. Unrelated thrown failures still trigger compensation for the whole copied graph.

AI-generated templates use one of two portable execution shapes:

- full-program exercises: `{{ STUDENT_CODE }}` with stdin/stdout tests and empty test harness code
- callable-unit exercises: `{{ STUDENT_CODE }}\n\n{{ TEST_CODE }}` with per-test harness code

The generation dialog always offers **Add to existing tests** (default) or **Replace all tests**, with an explanation of the selected operation. Counts default to 3 visible and 8 hidden and may each be 0–15, provided the sum is positive; the API enforces the same count rule. Add preserves existing tests, IDs, ordering, matchers, weights, and enablement and appends only the generated cases. A zero count leaves that kind unchanged in Add; Replace replaces the entire suite, so a zero count clears that kind. Add requests must fit the existing total limits of 15 visible and 50 hidden tests; the dialog shows the available capacity, reduces defaults when needed, and disables requests that would exceed it.

Add sends an optional `existingTests` object with complete `sampleTests` and `hiddenTests` from the current unsaved draft: IDs, titles/names, inputs, expected outputs, harness code, output matchers, line ordering, hidden weights, and enabled state, including disabled cases. The management-only generation route validates these fields with the ordinary authored-test schemas, preserving existing names and matchers rather than imposing generated-test restrictions. Every initial and correction prompt includes the full case data without summarizing it and instructs the model to return only the requested new cases, targeting uncovered behavior rather than renamed or similar variants of existing cases. Exact input/harness repeats are rejected across both kinds before Judge0 and sent through the correction loop. Replace and automatic bank variation omit existing-test context. Every new case receives an independent ID, including when the model reuses an existing ID. Replace remaps its generated validation summary to these new IDs; Add clears the displayed summary until the combined suite is validated on Save, which still reuses persisted fingerprints for unchanged cases.

The generation route targets those counts and validates cases independently against the reviewed reference solution. Passing cases and their validation fingerprints remain unchanged across up to three model attempts; correction prompts identify them and carry the complete immutable exercise context. Matching passing results are reused rather than re-executed. Malformed, failing, or unavailable cases do not discard the passing cases, including when a later model call fails or returns invalid JSON. If the requested counts cannot be reached, authoring receives only the validated subset and shows a localized warning with the retained/requested visible and hidden counts. If no test passes, generation reports an error and leaves the existing draft unchanged. Partial results preserve the current knowledge selections without running another suggestion request. These generated results remain unsaved until the ordinary Save action. Automatic bank variation saves validated subsets and reports incomplete counts as review warnings, as described above. Every retained generated test uses unordered **Contains lines** matching. Every generated expected output must therefore contain at least one non-empty line; callable test harnesses must print that result and cannot rely on silent assertions alone. Cognelo skips each invalid case before invoking Judge0 and includes the precise matcher problem in the normal AI correction prompt while validating its valid siblings. Every generated title/name is required, capped at 50 characters, and should briefly identify the behavior and expected outcome rather than use a generic category label. Hidden tests may intentionally exercise the same case type as a visible test with different input values; this overlap helps catch solutions that hard-code the published examples and is not treated as accidental duplication.

During generation only, an individual Judge0 request failure is recorded as an unavailable validation result so subsequent cases can still be checked; unavailable cases never count as passing. Uniform compilation or execution-service failures remain fatal when no case passes. Ordinary save validation and learner execution do not opt into this partial-result behavior.

Generated full-program tests must use inputs for which the reviewed reference solution exits successfully. The generator is explicitly told not to exercise invalid-input branches that return a non-zero status and to avoid ambiguous floating-point threshold values; execution-validation retries repeat those constraints when correcting a rejected suite.

Saving uses incremental reference validation. Each passing visible or enabled hidden result stores a fingerprint of every execution-relevant input: language, execution time limit, reference solution, private template, stdin, expected output, harness code, and output matcher. A later save reuses a passing result only when its fingerprint still matches; new tests, changed executable inputs, and previously failing tests run through Judge0. Renaming, reordering, or reweighting a test updates the merged summary without executing code, while changing the reference solution, language, time limit, or template invalidates all tests. Deleted or disabled hidden tests are simply removed from the active validation summary. The preflight response includes a short-lived HMAC-signed receipt over the exact save payload and merged summary, so the persistence request can use the same verified result without rerunning dirty tests. Missing, expired, changed, or tampered receipts fall back to server validation. Any dirty test failure continues to block the save before public authoring is persisted.

## Assessment Feedback And Grading

Core applies [team and student assignment exceptions](../../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md) to access, timing, attempts, grading, and challenge policy. Plugin routes consume the resolved assignment and core grade services; unsubmitted attempt deadlines resolve the latest effective limit from the original start, and the host refreshes policy every 20 seconds. Submitted timing stays fixed.

Programming Exercises declare both AI-feedback and AI-feedback-grading capabilities, but their rubric is a general teacher grading tool rather than an AI-only artifact. The activity's private reference-solution row retains the backward-compatible `privateConfig.aiFeedback` storage shape: a rubric can be configured and weighted into the grade while automatic feedback is disabled. Enabling automatic feedback additionally requires evaluator instructions; enabling rubric grading requires deterministic-test and rubric weights that total 100. The private configuration is copied by the existing bank/course lifecycle hooks with the other reference data.

Course and bank authoring add a host-level **Grading** tab immediately after **Concepts**. Inside it, a left-side **Rubric** section holds deterministic/rubric weighting, the unnamed general rubric, and optional automatic-feedback controls; a **Test cases** section holds test generation, visible sample tests, and hidden tests. The plugin keeps one mounted authoring state and portals that grading portion into the host tab, so switching either level of tabs cannot discard the combined public/private draft. Both Activity and Grading expose the same save/discard boundary.

The rubric editor validates complete private configuration inline before enabling Save. Adding or removing a criterion assigns a collision-free private criterion ID and redistributes integer criterion weights to total 100%; criterion removal uses the compact minus control beside its title. Teachers can then adjust those weights as long as the final total remains 100. When a question-authoring agent is available, the editor can generate all rubric criteria, but the control remains unavailable until the activity has a title, a student prompt, and a reference solution. The route validates the same requirements, returns strict criteria whose integer weights total 100, and uses the owning Subject's teaching language rather than the viewer locale. This prevents incomplete drafts from reaching the generic API-validation path while keeping the server schema authoritative.

Effective use also requires the course assessment-feedback switch and an accessible dedicated course model. With the course assignment set to **Formative with automatic AI feedback** (`formative_ai`), a learner submission creates a formative core attempt, calls the evaluator immediately, links the immutable evaluation to that core attempt and plugin execution, and returns sanitized summary, strengths, improvements, and criterion feedback without creating a core grade. Ordinary **Formative** creates the same inspectable formative attempt but never calls the evaluator or exposes prior model feedback. A summative submission persists the plugin execution and a summative core attempt but does not invoke AI. The detailed gradebook teacher action evaluates one attempt or a sequential batch directly; no background job or submission trigger runs summative AI grading. The evaluator resolves the course Subject's teaching language server-side, records it with the private request payload, and explicitly requires every learner-facing feedback field to use that language.

Starting a whole-activity AI grading batch first opens the shared guided-batch dialog. Its server-side preparation uses the plugin's `aiFeedback.batchGrading` handler to read the current private instructions and to classify template candidates. A Programming Exercise candidate must be a graded attempt with every rubric criterion scored and explained plus at least one non-empty Summary, Strength, or Improvement comment. The teacher may choose at most three. Selected attempts are examples rather than targets, so they are not reassessed in that batch. For each remaining evaluation, core revalidates that every template is a complete graded attempt for the same course activity, then loads the plugin-owned teacher submission and reviewed feedback. Only those sanitized artifacts—not participant names or email—reach the model. The effective run instructions always come from the dialog; when the default-on **Update AI instructions in the activity settings** checkbox remains selected, the plugin updates the course-owned private setting once before processing. The private evaluation snapshot retains the effective/configured instructions and template attempt references for reproducibility, while attempt identifiers are omitted from the model payload.

Every AI authoring call, Judge0 learner run/submit, and teacher save that performs reference-solution validation is covered by the shared non-dismissible progress dialog. These single remote operations are deliberately indeterminate. Activity-bank variation reports the durable job's actual percentage, while sequential gradebook AI assessment and test regrading report completed/total rows.

The additive `202609190010`–`202609190013` plugin migrations are safe from production `cognelo-0.7.4`: they create the evaluation table if absent, add the submission snapshot column if absent, and idempotently remove obsolete rubric-version and rubric-name JSON keys. A local rehearsal applied the exact 0.7.4 core and Programming Exercise baseline to an isolated database, upgraded twice with representative old rubric-name data, and also migrated a fresh database twice. `202609210010` adds the independent test-regrade table and indexes with `IF NOT EXISTS`, leaving existing executions unchanged; it applied successfully twice to the local development database. Every release must still pass the mandatory fresh-production-clone rehearsal in `docs/DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md`; these compatibility checks are not release approval.

Every submitted `PluginCodingExerciseExecution` retains its original test result and submission-time private feedback configuration. Teacher **Rerun automatic grading** runs the stored source against the currently enabled hidden tests and execution template without calling AI; each successful or failed rerun is a separate `PluginCodingExerciseTestEvaluation` containing the current private test/configuration snapshot. The latest successful rerun becomes the deterministic score used by later grade composition and feedback generation; a failed rerun does not replace the last successful result. The test-only action uses the latest available reviewed rubric score and current test/rubric weights. If rubric grading is enabled but no rubric score exists, it records the new test result and leaves the final grade unchanged pending rubric grading. Batch regrading continues after individual failures and reports graded/pending/failed counts.

Teacher-triggered **Assess with AI** does not run tests. Its confirmation explains that the action evaluates the rubric, generates feedback, and updates the combined grade using the configured weights. It evaluates the latest saved test result, current student prompt, submitted source, current private reference solution, and current private rubric/instructions; the rubric and current component weights are captured anew for each immutable model evaluation. Formative and Compound Test-child evaluations continue to use the submission-time rubric snapshot. `PluginCodingExerciseAiEvaluation` stores each immutable evaluation version, including the rubric/request snapshot, provider/model, prompt/schema versions, raw response, parsed and sanitized outputs, hashes, latency, deterministic score, rubric score, and combined weighted score. Strict schema validation allows one bounded correction retry. Raw artifacts remain teacher/private data; student DTOs receive only the sanitized result. Teacher-triggered failures map missing models, rejected credentials, rate limits, unreachable providers, and invalid structured responses to actionable safe messages; formative learners receive only the generic retry/manual-grading failure.

When AI grading is enabled, the plugin returns the configured combined score (for example, 60% deterministic hidden tests and 40% AI rubric) to the ordinary core gradebook lifecycle. When the effective summative assignment setting enables challenges, every released final grade is challengeable through the shared course workflow regardless of whether it was automatic, AI-assisted, or teacher-entered. Generated feedback that affected grading and teacher-authored released feedback can also be challenged as separate targets. Feedback-only automatic explanations leave the deterministic test grade unchanged and are not independently challengeable.

The server plugin also implements the batch grade-completion contract. It reads the current private grading policy once per activity and classifies a scored row as complete when rubric grading is disabled, rubric-score evidence exists in the normalized grading result, or the teacher recorded a final override. Otherwise the deterministic tests-only score is partial (`1/2`). The gradebook renders that state beside the numeric grade and counts it as a release blocker. Submitted rows with no grade are blocked by core; learners with no submitted attempt are deliberately excluded.

The plugin registers teacher feedback and manual-inspection renderers plus server handlers. From detailed gradebook results, **Review and grade** is available for every submitted summative exercise and whole-group review navigates all submitted learners. The summative dialog resolves the newest submitted/graded core attempt in the assignment's current mode and requests that feedback/evidence first; it requests an older attempt only when the teacher navigates to it. The teacher sees the submitted source followed by the latest successful hidden-test pass count and per-test outcomes, including available failure/status details, and always gets one multiline field each for Summary, Strengths, and Improvements without needing AI. A new feedback draft contains the current rubric (falling back to the submission snapshot only when current private authoring is absent) and latest deterministic result. Generated content pre-populates the same fields and criteria. Before the editable fields, a confirmed **Clear feedback content** action empties Summary, Strengths, Improvements, and every criterion explanation in the current draft. It deliberately preserves criterion scores, deterministic/rubric totals, and the final grade; nothing is persisted until the teacher saves the review, at which point the ordinary audited revision path applies. Each criterion displays its fixed configured weight beside its name. The same form shows the weighted automatic-tests contribution against the configured test proportion, the weighted rubric contribution against its configured proportion, and their calculated total out of 100 on one row; these values update as criterion scores change. The shared wrapper adds the editable final grade to the same surface and follows the calculated total until the teacher changes it. Existing teacher-set final grades remain overrides when rubric scores are revised. Blank Summary, Strengths, Improvements, or criterion narratives are allowed and omitted where applicable from learner views. Changing a criterion percentage recomputes the weighted rubric and combined score while keeping the deterministic test result and configured component/criterion weights fixed. Saving that change invokes the shared audited regrade service and records `feedback_teacher_grade_adjusted`; if the teacher also changes the final grade, the host applies an audited manual override after rubric recomposition. Narrative-only saves do not regrade. The first manual save records `feedback_teacher_authored` and is retained on the attempt until grading; later grading carries it into the learner-visible grade unless generated feedback supersedes it. Generated evaluation artifacts remain immutable and later edits record `feedback_teacher_revised`. A challenged response remains editable: core preserves the challenged hash and immutable artifact, then links the teacher revision's before/after grade and research events to the challenge. Formative rows deliberately bypass that regrade surface and use the plugin manual-inspection renderer, which loads the newest execution first, fetches older executions lazily, and shows source, tests, and attempt-linked generated feedback read-only. Learner-facing feedback copy deliberately says only “Feedback” and does not identify AI as the generator or grader.

The whole-class **Review and grade** flow uses the structured Programming Exercise renderer above. The common paged fallback still recognizes Programming Exercise submissions directly, loads them through `coding-exercises/review-all`, displays the submitted source, and persists ordinary core grade overrides; it must not fall through to another plugin's attempt route.

Once a gradebook item is released, the plugin's `studentGradeReport` handler supplies a sanitized learner report to the generic Grades endpoint. It verifies that the authenticated learner owns a grade on the released item, then returns every active submitted/graded core attempt with its source and latest successful saved test evaluation. The report recap scales the available deterministic-test and rubric contributions to the released grade's point total and omits either component when its configured weight is zero or its score is unavailable. The UI also shows the released final total, teacher comment/summary/strength/improvement fields, rubric criterion scores and explanations, and each test's pass/fail outcome plus earned/possible test weight. Hidden stdin, expected output, harness code, private rubric instructions, reference solutions, and raw model artifacts remain excluded.

### Development feedback-review fixture

The root Prisma seed publishes `C exercise: Median of three integers` as `seed-bank-activity-c-median-feedback` in the Programming basics bank and as `seed-activity-c-median-feedback` in Programming 101. It includes five exact-output hidden tests plus a private rubric that combines deterministic tests at 60% with rubric assessment at 40%. The activity is assigned summatively to all course sections. A clean seed creates 36 submitted attempts across Sections A and B: six correct programs, three programs with compilation errors, and varied programs with logic or exact-output-contract errors. If other linked students already exist in either section, the seed gives them submissions too. Executions snapshot the rubric, but evaluations and grades are intentionally absent until a teacher invokes the normal summative batch action. Reseeding does not replace a teacher-selected course feedback model or explicit feedback switch with the fallback seed connection.

## Judge0 Integration

Student view calls the same Judge0 execution primitives but bypasses `PluginCodingExerciseExecution` and all core-attempt/feedback snapshot creation. The result is serialized in the ordinary learner execution shape with `resultSummary.studentPreview=true`; callers must dispatch it only through the SDK stateless preview contract.

The browser should never call Judge0 directly.

The intended flow is:

1. web UI calls Cognelo plugin route
2. plugin route authenticates the user and loads the activity
3. plugin service builds a Judge0 submission payload
4. Cognelo server calls Judge0 with server-side credentials
5. Cognelo stores normalized run/submission results
6. Cognelo returns a filtered result to the browser

Implemented subroute:

```text
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/run
POST   /api/courses/:courseId/activities/:activityId/coding-exercises/run
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/submit
POST   /api/courses/:courseId/activities/:activityId/coding-exercises/submit
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/history
GET    /api/courses/:courseId/activities/:activityId/coding-exercises/hidden-tests
PUT    /api/courses/:courseId/activities/:activityId/coding-exercises/hidden-tests
```

The run/submit routes are also available through group-scoped assigned activity dispatch. Course and activity-bank authoring both manage private reference solutions, templates, rubrics, and hidden tests in their respective plugin-owned tables.

Plugin routes are declared in this package and mounted by the platform's generic dispatchers. Do not add coding-exercise-specific API route files in `apps/api`.

Behavior:

- `run` is for learner-visible preset and personalized execution; personalized runs explicitly disable output comparison and omit the sample harness
- `submit` evaluates against plugin-owned hidden tests, records summative group work in the shared core attempt lifecycle, and returns post-submission attempt availability
- blank or whitespace-only learner source keeps Run and Submit disabled; server validation also rejects direct empty payloads before runtime lookup, execution persistence, or a Judge0 request
- `history` returns active prior submissions (excluding references from deleted core attempts) with the practice runs that preceded them, plus only the unsubmitted runs belonging to the current attempt and the learner's current attempt availability
- The current-run panel in standalone and embedded Test exercises shows the newest execution by default. When older runs exist, a localized link immediately below it reveals all of them in newest-first order and can hide them again. A new run result, activity change, or page reload resets the disclosure; no saved history is removed. The previous-submission attempt accordions retain their existing run grouping.
- `hidden-tests` is teacher/admin only and carries the private reference solution
- Judge0 source is assembled server-side from the private template plus student code, then per-test harness code is injected at `{{ TEST_CODE }}` when present
- Cognelo always exchanges source, stdin, expected output, stdout, stderr, compiler output, and Judge0 messages as Base64 at the Judge0 boundary, decoding them before persistence and comparison. This preserves UTF-8 program text and output such as accented characters and also safely carries non-printable diagnostics.
- Cognelo compares the complete decoded Judge0 result first, then stores at most 16 KiB of each stdout/stderr/compiler-output stream and 4 KiB of each diagnostic message, cutting only at a UTF-8 character boundary. The same limits apply to hidden-test and reference-validation summaries. Execution/history and private validation responses apply the caps again to older oversized rows. Learners see a localized notice when a run or submission has shortened output; result status and scoring still reflect the complete Judge0 result.
- enabled hidden tests are validated against the teacher reference solution before they are saved

### Output matching

Each visible or hidden test has an explicit output comparison mode:

- **Exact** is the default and preserves legacy behavior by sending `expected_output` to Judge0. Tests saved before comparison modes existed normalize to Exact.
- **Contains lines** treats every non-empty expected-output line as literal text and requires it to occur within a stdout line; surrounding text on that stdout line is allowed. Trailing whitespace is removed from both expected and actual lines before comparison, while leading whitespace remains significant. Extra output is allowed. Teachers can optionally require the literal occurrences to appear in their authored order; duplicate expected lines require the same number of non-overlapping output occurrences.
- **Regular expression** searches stdout with the linear-time RE2 WebAssembly engine. It does not support backreferences or lookaround, and patterns are limited to 4,000 characters.

For Contains lines and Regular expression, Cognelo omits Judge0's `expected_output`. Judge0 must first report a successful compile and execution; Cognelo then evaluates stdout with the selected comparator. Compilation, runtime, resource-limit, and other sandbox failures always fail the test before output matching. The same comparator is used for teacher reference validation, student sample runs, and hidden-test grading.

For development, Judge0 runs locally in Docker on `http://localhost:2358`. Compose defaults to the pinned Apple Silicon image `ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2`; override `JUDGE0_IMAGE` when another architecture or approved build is required. The image exposes Cognelo's C, C++, Go, Java, JavaScript, Python, Rust, and TypeScript runtimes and has been validated with real submissions. Cognelo resolves only explicitly supported Judge0 runtime names; keep that allowlist synchronized with the exact versions advertised by the pinned image whenever the image changes. Both development Judge0 containers mount `infra/judge0/isolate.dev.conf`, whose expanded box range prevents Isolate 2.x from rejecting monotonically increasing Judge0 submission IDs after the default first 1,000 executions.

Judge0 compiler options remain disabled at the submission API boundary. Instead, both Compose stacks run the checked-in idempotent language-configuration SQL before starting workers. It adds the ordinary course-level Linux system libraries to every active C and C++ compile command: POSIX threads, math, dynamic loading, and POSIX realtime (`-pthread -lm -ldl -lrt`). The C and C++ driver already links the language standard library, while optional third-party libraries remain outside Cognelo's guaranteed runtime contract. Any Judge0 image or configuration upgrade must pass a real C `sqrt()` compile/execute smoke test.

Administrators configure the Judge0 base URL, optional authentication header/token, enablement, and per-process/thread limit behavior under **Settings → Runners**. The token is AES-256-GCM encrypted in core persistence and is never returned to the browser. Production should point this setting to the dedicated sandbox host, ideally through the private deployment network with host-level access controls. Local seed data creates the normal `http://localhost:2358` entry and enables the per-process/thread fallback used by Docker Desktop. Runtime code must resolve Judge0 through the core runner selector instead of reading an application environment variable.

The settings card's connection test performs authenticated language discovery and a real synchronous smoke submission using an available C, Python, JavaScript, or Bash runtime. Both checks must pass before the endpoint satisfies Cognelo's required Judge0 capabilities.

Judge0 status 13 (`Internal Error`) is an execution-service failure, never a learner test result. The plugin records the execution as failed before a trustworthy result, returns a retryable service error, and does not convert the affected hidden test into a wrong answer, partial grade, or plugin-counted submission attempt. Practice runs preceding that operational failure stay attached to the learner's next trustworthy submission. Legacy executions that persisted status 13 inside a finished result are excluded from learner history and teacher review, and AI evaluation refuses them. If such an execution already created a core summative attempt, a teacher must use **Student results → student action menu → Delete submission**, select the affected submission, and provide a reason so core attempt limits and gradebook state are reconciled. The [shared deletion flow](../../../../docs/GRADEBOOK_IMPLEMENTATION_PLAN.md#submission-deletion) retains the attempt and exposes the reason in student deletion history. Operators should inspect the Judge0 logs using the returned request time; the server log includes the Judge0 token and decoded internal message.

## Planned Next Modules

As this plugin grows, expect to add:

- richer execution policies per language/runtime
- richer teacher-side score/rubric comparison and operational metrics
- responsive teacher-authoring actions use the shared `EditActionBar`, with saved/unsaved status and snapshot-backed Cancel/Save

## Contributor Workflow

Standalone gradebook **Class overview** loads the private teacher reference solution and the latest plugin submission referenced by each row's current attempt mode through teacher-authorized routes, then shows one green/red pass/fail bar per enabled hidden test. Hidden tests use their stable authoring identifier, with test-name matching retained for legacy execution rows. Hover text lists the students in each result segment. Formative-to-summative conversion therefore leaves the earlier formative executions inspectable but excludes them from the summative aggregate. The same overview lists every current rubric criterion with its description and weight. Its average and five score bands prefer the selected grade's current sanitized feedback, so manual rubric grading and later teacher revisions take precedence over the original AI evaluation. When formative work intentionally has no grade, the overview instead uses the matching execution's latest completed rubric evaluation. Ungraded criteria stay visible without being counted as zero.

When changing this plugin, update this detailed reference, the package README if its overview or routing changed, and `PROJECT_MEMORY.md` only when a durable invariant changed. Update root documents only for platform-wide contracts.

## Reopening the last submission

Restores source code from the exact learner-owned execution to the core response draft without changing the immutable execution. The next ordinary submission creates fresh execution evidence on the same core attempt. The shared [continuation service](../../../../docs/SUBMISSION_CONTINUATION.md) enforces latest-attempt and staff scope, archives prior evidence, preserves attempt identity and original start, and applies current General/section/team/student settings. Later extensions or individual exceptions therefore affect the resumed deadline without resetting it.


## Live authoring and grade visibility

Course prompt/config updates preserve learner code. Private saves use the core live-authoring transaction and append full before/after data to `PluginCodingExerciseAuthoringRevision`; core audits contain only hashes. Migration `202610130010_authoring_revisions` is registered in `src/db.ts`, including backup ownership, and deletion hooks remove revisions. Reference validation still applies. Zero enabled hidden tests produce a saved submission with `accepted: null`, `gradingPending: true`, and no automatic grade; compound submission proceeds with `gradingResult: null`. Summative submission and history APIs withhold execution outcomes, summaries, and diagnostics until release, while sample runs remain visible.

Shared confirmation, submitted-Test snapshots, and concurrency are documented in [Live activity authoring](../../../../docs/LIVE_ACTIVITY_AUTHORING.md).


## Explicit solution release

This type supports the shared [Solution tab](../../../../docs/ACTIVITY_SOLUTIONS.md). Course settings must opt in; summative work additionally requires grade release. The learner first sees encouragement to try independently and must press **Show solution**. The same provider serves this type inside a Test under the parent switch. See the linked reference for formats, live revocation, API boundaries, and current-reference semantics.

## Test automatic regrading

The core [Test regrading batch](../../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#teacher-automatic-regrading) reevaluates every submitted child against current grading rules, including previously graded work. Individual and whole-class actions show measured progress. Saved answers, original timing, submitted composition/point weights, and grade-release state remain fixed. Each successful rerun is audited; an individual failure does not stop later exercises, and an incomplete batch leaves the parent total unchanged. Recovery may initially preserve responses without a grade or runner artifact; later teacher regrading uses the same batch. No AI feedback is requested automatically. Standalone behavior is unchanged.

The plugin registers `compositeExecution.regrade` to verify learner/activity/source ownership, retain the original execution ID, append a test evaluation, and compose current test/rubric weights with the Test child’s reviewed feedback. Missing rubric evidence defers the child grade while keeping the new deterministic evidence. A recovered response with no execution uses ordinary composite submission first.

### Timestamp display

Submission, review, and other dated UI records use the shared effective course timezone: the administrator’s application default unless a course owner has selected an allowed override. Stored instants remain UTC; plugin UI must not infer a timezone from the learner device. See [Application time](../../../../docs/APPLICATION_TIME.md) for the shared context and clock/security contract.
