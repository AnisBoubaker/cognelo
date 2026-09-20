# Plugin: MCQ

This README is for the MCQ plugin only.

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
- the activity option `randomizeChoices` can show choices in randomized order while keeping grading tied to stable choice IDs

## Current State

The plugin stores authored content in generic bank/course activity config. Assigning from an activity bank therefore uses the platform's generic config copy. Summative student submissions are persisted as core `ActivityAttempt` records and graded through the shared gradebook workflow. The plugin also owns private immutable `PluginMcqAiEvaluation` rows for generated assessment feedback artifacts; those rows are operational evaluation data, not authored activity data.

Unsubmitted standalone answers autosave through the core `ActivityResponseDraft` state host for both formative and summative MCQs. Reloading or a periodic account refresh restores that draft without replacing newer in-memory answers. Final summative submission clears the draft after the graded attempt is recorded. Embedded Test MCQs remain on the Test execution host and continue to autosave into `TestItemAttempt`; they never use the standalone draft route.

Explicit course/bank synchronization also relies entirely on the platform's generic title, description, config, metadata, and concept copying. Core blocks bank-to-course retrieval after any attempt, while course-to-bank publication remains allowed because it creates a new bank version without replacing attempted course content.

Bank version comparison is fully covered by the shared core diff because MCQ authoring lives in generic versioned config.

Draft MCQ saves update mutable bank authoring without creating a version; a changed save explicitly kept Published creates the next immutable version.

For summative activities that permit another attempt, the **New attempt** tab starts with an empty editable response even when a completed submission exists. Completed answers remain under **Previous submissions**, where the student can select any of their own submissions by timestamp; an unfinished attempt still resumes its saved answers.

When the configured attempt limit is exhausted, reopening the activity shows submission history without a new-attempt form. The submission route independently rechecks availability and rejects any extra request, even if a client bypasses the UI.

Before the teacher releases the final grade, this repeatable-assessment review shows the student each attempt’s provisional score and MCQ feedback so it can inform the next attempt. Grade release publishes the final grade selected by the gradebook strategy and closes further attempts; single-attempt summative results remain hidden until release.

Submitted-answer review uses a green row for a missed correct choice so the correct answer remains visually recognizable, while retaining the orange exclamation icon that distinguishes it from a correctly selected answer.

MCQ declares composite-execution support for core Tests. The Test runtime embeds the existing MCQ student view through the web activity-renderer registry and autosaves answer state into a generic `TestItemAttempt`. Embedded MCQs have no individual Submit button: the Test's single final submission sends every saved MCQ state to the MCQ server adapter for deterministic grading. Core Test orchestration does not import MCQ schemas; future activity plugins opt in with their own capability plus server and web adapters.

When a teacher has selected an enabled question-authoring AI agent in global settings, the authoring UI exposes a collapsed "Generate questions with AI" section. Teachers can provide private model instructions, request from 1 to 80 questions, and select a generation-only default code language. MCQ source config accepts up to 100,000 characters so a valid large batch remains saveable. All three controls are stored in the generic MCQ activity config and copied with the activity between the bank and a course. Generation uses those saved controls and the student prompt, but only the student prompt is rendered to learners. If the source field already contains content, the UI asks for confirmation before replacing it. The server route keeps the agent key private, injects subject/language/syntax requirements into the prompt, validates the generated source and requested question count with the MCQ parser, and scales the output allowance for larger batches. Syntax generation retries up to three calls. Every syntax-valid result then receives a mandatory model-based answer-key audit that independently solves each question, makes single-answer distractors unambiguously false, and marks every objectively correct option in explicitly worded multi-answer questions; the audited source is parsed again and receives one corrective retry before the route returns an error.

The same panel offers `Use selected skills`, `Suggest skills`, and `Ignore skills`. Every mode provides the complete subject catalog to the generation model as a curriculum boundary. Selected mode additionally targets the current draft skills. Suggested skills are selected from the subject catalog after the MCQ source validates and are applied to the unsaved host Concepts-tab draft. Ignore mode does not read or change that draft and performs no suggestion pass.

The saved AI language choice defaults to `none`, shown as "Not a programming exercise." It affects AI generation only: generated code fences must explicitly declare the selected programming language, for example ` ```python `. Manually authored code fences must include their own language identifier when syntax highlighting is wanted; unlabeled fences render as plain text regardless of the saved AI language.

In activity-bank lists, MCQ rows display the activity title without repeating the student prompt beneath it.

The MCQ authoring UI must stay registered with `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Any new MCQ authoring option, generated-content panel, or settings form should participate in that same dirty/save/discard flow.

The authoring form uses the shared responsive `EditActionBar` to display saved/unsaved status and expose Cancel/Save against that same draft snapshot.

## AI Assessment Feedback

MCQ declares AI-feedback support but deliberately does not declare AI-feedback-grading support. Enabling `aiFeedbackEnabled` requires non-empty `aiFeedbackInstructions` in the activity configuration, plus the course assessment-feedback master switch and an accessible dedicated model. The existing deterministic answer-key result remains authoritative regardless of AI success or failure.

For formative MCQs, **Check answers** requests explanations immediately and presents the sanitized overall and per-question feedback. For summative MCQs, submission still grades deterministically and never invokes AI; a teacher starts feedback generation from the detailed gradebook, and students receive it only after grade release. Because the model output does not influence the score, MCQ feedback is not eligible for the mandatory AI-grade challenge workflow.

Each `PluginMcqAiEvaluation` version stores the request snapshot, model/provider and connection identifiers, raw and parsed responses, sanitized feedback, hashes, latency, prompt/schema versions, and failure details. The evaluator requires feedback for the exact stable question IDs and permits one bounded correction retry. Raw artifacts remain private; only the sanitized result is attached to the grade.

MCQ registers a teacher feedback renderer and server handlers. **Feedback** is available for every submitted MCQ and whole-group review navigates all submitted learners. A teacher can see the submitted choices and author an overall summary without AI; if generated feedback exists, the same form is pre-populated and also exposes its per-question explanations. The deterministic score and answer-key grading remain read-only and authoritative. Core stores pre-grade manual feedback on the attempt, carries it into later grading, and records `feedback_teacher_authored`/`feedback_teacher_revised`; any original `PluginMcqAiEvaluation` remains immutable. Learner-facing headings and errors use neutral “Feedback” wording rather than identifying AI as the source.

## Contributor Workflow

Standalone MCQ gradebook results expose **Review all** and reuse the Test aggregate report: correct choices, response counts, exact-answer accuracy, score statistics, and hoverable respondent names per choice.

When changing this plugin, update:

- `packages/plugin-activities/plugin-mcq/README.md`
- `packages/plugin-activities/plugin-mcq/PROJECT_MEMORY.md`
