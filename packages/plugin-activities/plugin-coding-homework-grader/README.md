# Plugin: Coding Homework Grader

`@cognelo/plugin-coding-homework-grader` provides C homework preparation, immutable hand-in, queued challenge questions, timed/SEB answering and teacher grading.

Students prepare work by choosing individual files (uploaded at the root) or replacing the whole collection with a ZIP that preserves its folders. The preparation UI has no destination-folder field or Create folder action. Files persist across visits in the shared left-tab explorer, with the first file opened automatically. Before **Submit my work**, a tab’s cross removes that file after confirmation, and **Remove all files** clears the draft after confirmation. File contents remain read-only. There is no browser code editor. Students explicitly choose **Check my submission** to see a structural result. Valid structure reveals Submit my work; academic gaps require **I want to submit incomplete work** before showing it. File changes clear the check/acknowledgement. The UI explains that required filenames/function signatures do not prove correctness, and submission requires an immutable-work warning. File safety failures remain blocking.

Teachers upload a private C solution and choose required filenames/functions manually or with AI assistance. ZIPs replace the solution; files and detected functions can be removed individually or cleared together, with linked requirements reconciled. In a course, **Reference materials** holds the embedding connection/model and material selection (defaulting to visible materials before the activity). **Settings** holds the question-generation connection/model, private AI question-generation instructions, generation concurrency, Generate embeddings, and the manual final-submission switch. Both tabs preserve the activity draft and reference selection. Preparation shows the current material; failures name it inline and in the shared notification center, and retry reuses completed indexes. Material plugins own extraction/index refresh through core. GitHub freshness is configured on each repository material and checked when submissions open.

Final hand-in freezes the actual validated files and atomically queues generation. Default parallelism is 2 students, configurable up to a server-wide ceiling of 4. The generation panel shows a spinner and live queue position while waiting, then switches to an active generation message without suggesting that the student leave. **Answer challenge questions** starts the core attempt and timer after any required SEB verification. Each challenge displays its submitted function code and filename read-only beside the answer area. Ordinary course materials and the complete submitted files stay accessible. Submitted work uses the shared left-tab view: filenames on the left, read-only code on the right, and the first file opened automatically. The content starts level with the first tab, without repeating the filename or file size above it. New questions use the course Subject’s teaching language, independently of the session UI language; teacher generation instructions guide question focus and style. Challenges test understanding of the submitted code through one focused point answerable in 2–3 sentences, at a difficulty a student who wrote the code can reasonably handle. Concrete cases, conditions and local implementation choices provide varied question types. Deadline finalization submits saved answers, including blanks.

Teachers can cancel queued, answering or completed submissions from the activity details page (or editor): the old work is retained, associated grades are withdrawn, late generation cannot revive it, and the student may submit again. Students cannot cancel their frozen hand-in or question-generation job.

Questions exclude unchanged functions from teacher-provided C/H files and ZIP contents. Comments and formatting are ignored; changed implementation tokens remain eligible. Hand-in saves only a compact comparison manifest of hashes and function names, never another copy of the provided files. Private teacher solutions do not participate. See [provided-code comparison](docs/REFERENCE.md#excluding-unchanged-provided-code) for versioning and the no-eligible-code outcome.

Students see only two conditional download actions: the assignment PDF and one ZIP containing the provided files. A sole uploaded ZIP is returned unchanged; other provided attachments are bundled with safe unique names. Teacher PDF previews/View PDF remain inline. Authorized file responses preserve bytes and content type.

Challenge answering uses distinct numbered cards with the question first, a framed read-only code panel and a labelled answer area. Code and answer sit side by side when space permits and stack on small screens; long code scrolls within its panel. Autosave and submission behavior are preserved.

Students may submit some or all challenge answers blank. Manual submission first confirms that answers cannot be changed and lists unanswered question numbers; Cancel returns to editing. Timeouts finalize saved answers automatically without confirmation. Student operation failures use the shared notifications/history instead of a page-top error banner.

## Read by topic

- [Approved choices and delivery scope](../../../docs/CODING_HOMEWORK_SUBMISSION_WORKFLOW.md)
- [Current routes, persistence and boundaries](docs/REFERENCE.md)
- [Durable decisions and historical pipeline](docs/DECISIONS.md)
- [Implementation checkpoints and validation](../../../docs/CODING_HOMEWORK_IMPLEMENTATION_PROGRESS.md)
- [Reusable AI connections and model choices](../../../docs/AI_MODEL_CONNECTIONS.md)
- [Material embedding services](../../../docs/MATERIAL_EMBEDDING_SERVICES.md)
- [Queue concurrency and recovery](../../../docs/BACKGROUND_JOBS.md)
- [Assignment exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md), [content closure](../../../docs/ACTIVITY_CONTENT_ACCESS.md), [submission continuation](../../../docs/SUBMISSION_CONTINUATION.md), and [answer exports](../../../docs/ANSWER_EXPORTS.md)

## Boundaries

Private solutions, model prompts, retrieved reference excerpts, credentials, filesystem paths and processing diagnostics stay server-side. Learners receive explicit public projections. Requirements use bounded static C normalization without compilation or execution; typedef spellings remain significant. Generated Prisma clients are ignored local artifacts; track schemas/migrations and regenerate through the normal database commands.

Course/bank copies retain independent authoring and private solutions but clear submission enablement and prepared reference selection. Student view remains inspection-only. Teacher review/grading respects course and section staff capabilities; authoring and submission opening require course management. The activity does not advertise a released student-solution capability.

Local acceptance tests use a controlled AI endpoint owned by a disposable account and scoped to its synthetic course, with real APIs, persistence, queues and browser UI. Shared login AI preferences stay untouched; see [fixture isolation](../../../tests/e2e/README.md#ai-fixture-isolation). Native SEB launch is simulated at its boundary; real activation/proof/configuration scoping is tested. See the progress record for actual checks and outstanding work.
