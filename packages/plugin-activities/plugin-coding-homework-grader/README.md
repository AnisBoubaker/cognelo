# Plugin: Coding Homework Grader

`@cognelo/plugin-coding-homework-grader` provides C homework preparation, immutable hand-in, queued challenge questions, timed/SEB answering and teacher grading.

Students prepare work by choosing individual files (uploaded at the root) or replacing the whole collection with a ZIP that preserves its folders. The preparation UI has no destination-folder field or Create folder action. Files persist across visits and can be removed/replaced until **Submit my work**. There is no browser code editor. Static filename/function-signature checks distinguish incomplete work requiring acknowledgement from blocking safety failures.

Teachers upload a private C solution and choose required filenames/functions manually or with AI assistance. ZIPs replace the solution; files and detected functions can be removed individually or cleared together, with linked requirements reconciled. In a course, **Reference materials** holds the embedding connection/model and material selection (defaulting to visible materials before the activity). **Settings** holds the question-generation connection/model, private AI question-generation instructions, generation concurrency, Generate embeddings, and the manual final-submission switch. Both tabs preserve the activity draft and reference selection. Preparation shows the current material; failures name it inline and in the shared notification center, and retry reuses completed indexes. Material plugins own extraction/index refresh through core. GitHub freshness is configured on each repository material and checked when submissions open.

Final hand-in freezes the actual validated files and atomically queues generation. Default parallelism is 2 students, configurable up to a server-wide ceiling of 4. Students can leave and return while questions generate. **Answer challenge questions** starts the core attempt and timer after any required SEB verification. Each challenge displays its submitted function code and filename read-only beside the answer area. Ordinary course materials and the complete submitted files stay accessible. Submitted work uses the shared left-tab view: filenames on the left, read-only code on the right, and the first file opened automatically. The content starts level with the first tab, without repeating the filename or file size above it. New questions use the course Subject’s teaching language, independently of the session UI language; teacher generation instructions guide question focus and style. Deadline finalization submits saved answers, including blanks.

Teachers can cancel queued, answering or completed submissions from the activity details page (or editor): the old work is retained, associated grades are withdrawn, late generation cannot revive it, and the student may submit again. Students cannot cancel their frozen hand-in or question-generation job.

Assignment PDF previews and View PDF use authorized file responses that preserve the PDF bytes and content type.

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

Local acceptance tests use a controlled AI endpoint with real APIs, persistence, queues and browser UI. Native SEB launch is simulated at its boundary; real activation/proof/configuration scoping is tested. See the progress record for actual checks and outstanding work.
