# MCQ Detailed Reference

This document is the detailed reference for the MCQ plugin.

## Purpose

`@cognelo/plugin-mcq` provides a text-first multiple-choice and multiple-select activity type.

Teachers author MCQ content in an advanced editor using a Markdown-like grammar with task-list style answer markers.

Students see the activity description as a student prompt before a rendered MCQ activity with single-choice or multi-choice controls inferred from the authored answer key.

During authoring, the complete source editor and rendered preview appear side by side. The source remains one copyable text block so teachers can paste or save a full activity outside Cognelo.

The student prompt uses the shared Markdown-backed `RichTextEditor` from `@cognelo/activity-ui`. Its Visual and Markdown bodies have one fixed shared height, resize together from the bottom handle, scroll internally, and can each open full-screen from the far-right mode-bar action. Teachers can edit visually, insert or edit inline/display equations through its mouse/touch equation builder, insert and reshape portable GFM tables with contextual row/column controls, upload and edit reference-managed images with required alternative text and three width modes, or switch to the always-available Markdown source mode; the stored activity description remains Markdown. Table cell merging is omitted because standard GFM has no span representation.

Student prompts may contain long reading passages up to 30,000 characters. The MCQ generation route accepts the same limit so a passage can be used as generation context.

## Authoring Model

The main MCQ source is written as text.

- `##` headings define questions
- `#` headings define introductory or between-question sections; Markdown following such a heading is rendered before the next question
- `---` starts an untitled between-question section; Markdown following it is rendered before the next question
- `- [x]` defines a correct answer
- `- [ ]` defines an incorrect answer
- fenced code blocks are syntax-highlighted in the rendered student view
- inline mathematics supports both `$...$` and standard LaTeX `\\(...\\)` delimiters; display mathematics supports `$$...$$` and `\\[...\\]`, rendered with KaTeX
- a literal dollar sign is escaped as `\$`; wrapping it in inline code as `` `$` `` is also supported when code styling is desired
- choices can contain fenced code blocks, including code-only alternatives where the marker line is followed by the code block
- question prompts and choices can contain Markdown images such as `![Alternative text](https://example.org/image.png)`; images remain responsive to the available width and are sanitized by the shared renderer
- question prompts and choices can contain portable GFM tables written with a header row, delimiter row, and data rows
- the activity option `randomizeChoices` can show choices in randomized order while keeping grading tied to stable choice IDs

## Current State

The compound Test answer review marks an MCQ answered only when every question has at least one valid selected choice. `hasMcqAnswer` checks response presence without consulting correctness; a wrong choice counts exactly like a right one.

Core applies [team and student assignment exceptions](../../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md) to access, timing, attempts, grading, and challenge policy. Plugin routes consume the resolved assignment and core grade services; unsubmitted timed-attempt deadlines use the earlier of the original start plus the latest effective limit and the effective Until date, and the host refreshes policy every 20 seconds. Submitted timing stays fixed.

Teacher Student view uses the same parser and deterministic answer-key grader but keeps answers in browser session storage. Its SDK preview handlers return an ephemeral submission/result and never call the core attempt or plugin AI-evaluation persistence paths.

The plugin stores authored content in generic bank/course activity config. Assigning from an activity bank therefore uses the platform's generic config copy. Every standalone formative **Check answers** action and summative submission is persisted as a mode-tagged core `ActivityAttempt`; only summative attempts are graded through the shared gradebook workflow or counted against summative limits. The assignment policies `formative` and `formative_ai` both create a core formative attempt so old consumers remain compatible. Teachers can inspect either mode, while a learner opening a summative activity sees only its summative submission history. The plugin also owns private immutable `PluginMcqAiEvaluation` rows for generated assessment feedback artifacts; those rows are operational evaluation data, not authored activity data.

Unsubmitted standalone answers autosave through the core `ActivityResponseDraft` state host for both formative and summative MCQs. Reloading or a periodic account refresh restores that draft without replacing newer in-memory answers. Final summative submission clears the draft after the graded attempt is recorded. Embedded Test MCQs remain on the Test execution host and continue to autosave into `TestItemAttempt`; they never use the standalone draft route.

An MCQ can be timed through the course activity's General/group assignment settings in either formative or summative mode. Core presents the explicit start gate, resolves the live effective limit on the ordinary attempt, blocks draft/submission bypasses before start, and renders the countdown. At zero, the host's `TimedActivityAutoSubmit` signal invokes the same formative check or summative submission function used by the visible action; deterministic grading, feedback behavior, attempt history, and draft cleanup therefore do not gain a parallel timed code path.

Explicit course/bank synchronization also relies entirely on the platform's generic title, description, config, metadata, and concept copying. Core blocks bank-to-course retrieval after any attempt, while course-to-bank publication remains allowed because it creates a new bank version without replacing attempted course content.

Bank version comparison is fully covered by the shared core diff because MCQ authoring lives in generic versioned config.

Draft MCQ saves update mutable bank authoring without creating a version; a changed save explicitly kept Published creates the next immutable version.

For summative activities that permit another attempt, the **New attempt** tab starts with an empty editable response even when a completed submission exists. Completed answers remain under **Previous submissions**, where the student can select any of their own submissions by timestamp; an unfinished attempt still resumes its saved answers. A `formative_ai` check stores its generated overall and per-question feedback against that exact attempt and displays it with the corresponding previous submission. Ordinary formative policy never requests model feedback and suppresses any legacy model artifact from the learner view.

When the configured attempt limit is exhausted, reopening the activity shows submission history without a new-attempt form. The submission route independently rechecks availability and rejects any extra request, even if a client bypasses the UI.

All summative scores and feedback remain hidden until the teacher releases grades, including repeatable assessments. Release publishes the grade selected by the gradebook strategy and closes further attempts. Learner answer review may mark selected answers but no longer reveals missed correct choices; the full key belongs to the separately enabled, explicit Solution tab.

Teacher submitted-answer review uses a green row for a missed correct choice so the correct answer remains visually recognizable, while retaining the orange exclamation icon that distinguishes it from a correctly selected answer.

MCQ declares composite-execution support for core Tests. The Test runtime embeds the existing MCQ student view through the web activity-renderer registry and autosaves answer state into a generic `TestItemAttempt`. Embedded MCQs have no individual Submit button: the Test's single final submission sends every saved MCQ state to the MCQ server adapter for deterministic grading. Core Test orchestration does not import MCQ schemas; future activity plugins opt in with their own capability plus server and web adapters.

When a teacher has selected an enabled question-authoring AI agent in global settings, the authoring UI exposes a collapsed "Generate questions with AI" section. Teachers can provide private model instructions, request from 1 to 80 questions, and select a generation-only default code language. MCQ source config accepts up to 100,000 characters so a valid large batch remains saveable. All three controls are stored in the generic MCQ activity config and copied with the activity between the bank and a course. Generation uses those saved controls and the student prompt, but only the student prompt is rendered to learners. If the source field already contains content, the UI asks for confirmation before replacing it. The server route keeps the agent key private, injects subject/language/syntax requirements into the prompt, validates the generated source and requested question count with the MCQ parser, and scales the output allowance for larger batches. Syntax generation retries up to three calls. Every syntax-valid result then receives a mandatory model-based answer-key audit that independently solves each question, makes single-answer distractors unambiguously false, and marks every objectively correct option in explicitly worded multi-answer questions; the audited source is parsed again and receives one corrective retry before the route returns an error.

Question generation and formative feedback calls display the shared blocking progress dialog with an indeterminate bar because their providers expose no trustworthy intermediate percentage. Summative persistence uses the same dialog while the confirmed submission request is in flight. Activity-bank variations continue to expose the host background job's real percentage and completed activity count.

The same panel offers `Use selected skills`, `Suggest skills`, and `Ignore skills`. Every mode provides the complete subject catalog to the generation model as a curriculum boundary. Selected mode additionally targets the current draft skills. Suggested skills are selected from the subject catalog after the MCQ source validates and are applied to the unsaved host Concepts-tab draft. Ignore mode does not read or change that draft and performs no suggestion pass.

The activity-bank **Create variation** action runs as a background operation after core has created an independent draft and copied its exact concept selections. The plugin generates a distinct student introduction and the same number of new questions at comparable difficulty, while retaining generation/display/feedback settings. The generated source passes the ordinary syntax/count checks and mandatory independent answer-key audit before it is saved. Optional instructions entered in the variation dialog guide only that run and are not persisted in `aiGenerationInstructions`.

The saved AI language choice defaults to `none`, shown as "Not a programming exercise." It affects AI generation only: generated code fences must explicitly declare the selected programming language, for example ` ```python `. Manually authored code fences must include their own language identifier when syntax highlighting is wanted; unlabeled fences render as plain text regardless of the saved AI language.

In activity-bank lists, MCQ rows display the activity title without repeating the student prompt beneath it.

The MCQ authoring UI must stay registered with `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Any new MCQ authoring option, generated-content panel, or settings form should participate in that same dirty/save/discard flow.

The authoring form uses the shared responsive `EditActionBar` to display saved/unsaved status and expose Cancel/Save against that same draft snapshot.

## AI Assessment Feedback

MCQ declares AI-feedback support but deliberately does not declare AI-feedback-grading support. Enabling `aiFeedbackEnabled` requires non-empty `aiFeedbackInstructions` in the activity configuration, plus the course assessment-feedback master switch and an accessible dedicated model. The existing deterministic answer-key result remains authoritative regardless of AI success or failure.

For MCQs assigned as **Formative with automatic AI feedback** (`formative_ai`), **Check answers** requests explanations immediately and presents the sanitized overall and per-question feedback. The evaluation is linked to the exact core attempt and plugin submission. Ordinary **Formative** performs the deterministic check without calling the model or exposing previously generated model feedback. For summative MCQs, submission still grades deterministically and never invokes AI; a teacher starts feedback generation from the detailed gradebook, and students receive it only after grade release. Because the model output does not influence the score, the generated explanation is not an independent challenge target. The released deterministic grade and teacher-authored released feedback remain challengeable through the mechanism-neutral core workflow when the effective summative assignment setting permits it.

Each `PluginMcqAiEvaluation` version stores the request snapshot, model/provider and connection identifiers, raw and parsed responses, sanitized feedback, hashes, latency, prompt/schema versions, and failure details. The model and client live in the MCQ package's local Prisma boundary; the historical core migration that first created the physical table remains untouched for deployed-database compatibility. The evaluator requires feedback for the exact stable question IDs and permits one bounded correction retry. Raw artifacts remain private; only the sanitized result is attached to the grade.

MCQ registers a teacher feedback renderer and server handlers. **Review and grade** is available for every submitted MCQ and whole-group review navigates all submitted learners. A teacher can see the submitted choices and author an overall summary without AI; if generated feedback exists, the same form is pre-populated and also exposes its per-question explanations. The gradebook-attempt route accepts an optional exact core attempt ID while still constraining the query by course, group, activity, participant, plugin, and completed lifecycle. The shared report uses that boundary to fetch the newest current-mode submission first and retrieve older submissions only when navigated to. Summative attempts use the normal editable review path; historical and formative attempts use the read-only inspector, which shows the exact submitted answers and any generated feedback attached to that attempt without calling the regrade endpoint. The revision handler returns feedback only and never a grading result, so **Assess with AI** explicitly says that the deterministic answer-key grade will not change. The shared review wrapper still allows a teacher to replace the final grade through the ordinary audited override. Core stores pre-grade manual feedback on the attempt, carries it into later grading, and records `feedback_teacher_authored`/`feedback_teacher_revised`; any original `PluginMcqAiEvaluation` remains immutable. Learner-facing headings and errors use neutral “Feedback” wording rather than identifying AI as the source.

## Contributor Workflow

Standalone MCQ gradebook results expose **Class overview** and reuse the Test aggregate report: correct choices, response counts, exact-answer accuracy, score statistics, and hoverable respondent names per choice.

When changing this plugin, update this detailed reference, the package README if its overview or routing changed, and `PROJECT_MEMORY.md` only when a durable invariant changed.

## Reopening the last submission

Restores the submitted choices to the core response draft; the ordinary submission path reuses the reopened core attempt. The shared [continuation service](../../../../docs/SUBMISSION_CONTINUATION.md) enforces latest-attempt and staff scope, archives prior evidence, preserves attempt identity and original start, and applies current General/section/team/student settings. Later extensions or individual exceptions therefore affect the resumed deadline without resetting it.


## Live authoring and grade visibility

The learner source/description updates in place without clearing selected answers. `reconcileMcqResponseState` matches surviving questions and choices by authored content, with positional correction fallback. Compound drafts also retain the configuration they answered. The server grades the current key at submission. Summative submission/history responses return no grade until release; previous-submission UI uses the same release gate.

Shared confirmation, submitted-Test snapshots, and concurrency are documented in [Live activity authoring](../../../../docs/LIVE_ACTIVITY_AUTHORING.md).


## Explicit solution release

This type supports the shared [Solution tab](../../../../docs/ACTIVITY_SOLUTIONS.md). Course settings must opt in; summative work additionally requires grade release. The learner first sees encouragement to try independently and must press **Show solution**. The same provider serves this type inside a Test under the parent switch. See the linked reference for formats, live revocation, API boundaries, and current-reference semantics.

## Recovered Test responses

The core [Test recovery lifecycle](../../../../docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md#timeout-recovery) may submit saved embedded responses without calling the plugin runner. These children remain ungraded. When the teacher requests automatic grading, core supplies the saved response and current authored activity to the existing composite submission handler under the learner’s identity, retains the original response/result in its audit, and recomputes the parent only when every child has a grade. No AI feedback is requested automatically. Standalone submission behavior is unchanged.
