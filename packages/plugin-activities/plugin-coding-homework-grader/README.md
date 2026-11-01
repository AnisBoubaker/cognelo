# Plugin: Coding Homework Grader

`@cognelo/plugin-coding-homework-grader` provides C homework preparation, immutable hand-in, queued challenge questions, timed/SEB answering and teacher grading.

Students prepare work by uploading individual files into folders or replacing the whole collection with a ZIP. Files persist across visits and can be removed/replaced until **Submit my work**. There is no browser code editor. Static filename/function-signature checks distinguish incomplete work requiring acknowledgement from blocking safety failures.

Teachers upload a private C solution and choose required filenames/functions manually or with AI assistance. In a course, they select references (defaulting to visible materials before the activity), generate/reuse embeddings, then enable final submissions manually. Material plugins own extraction/index refresh through core. GitHub freshness is configured on each repository material and checked when submissions open.

Final hand-in freezes the actual validated files and atomically queues generation. Default parallelism is 2 students, configurable up to a server-wide ceiling of 4. Students can leave and return while questions generate. **Answer challenge questions** starts the core attempt and timer after any required SEB verification. Submitted files remain read-only; ordinary course materials stay accessible. Deadline finalization submits saved answers, including blanks.

Teachers can cancel queued, answering or completed submissions from the activity details page (or editor): the old work is retained, associated grades are withdrawn, late generation cannot revive it, and the student may submit again. Students cannot cancel their frozen hand-in or question-generation job.

## Read by topic

- [Approved choices and delivery scope](../../../docs/CODING_HOMEWORK_SUBMISSION_WORKFLOW.md)
- [Current routes, persistence and boundaries](docs/REFERENCE.md)
- [Durable decisions and historical pipeline](docs/DECISIONS.md)
- [Implementation checkpoints and validation](../../../docs/CODING_HOMEWORK_IMPLEMENTATION_PROGRESS.md)
- [Material embedding services](../../../docs/MATERIAL_EMBEDDING_SERVICES.md)
- [Queue concurrency and recovery](../../../docs/BACKGROUND_JOBS.md)
- [Assignment exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md), [content closure](../../../docs/ACTIVITY_CONTENT_ACCESS.md), [submission continuation](../../../docs/SUBMISSION_CONTINUATION.md), and [answer exports](../../../docs/ANSWER_EXPORTS.md)

## Boundaries

Private solutions, model prompts, retrieved reference excerpts, credentials, filesystem paths and processing diagnostics stay server-side. Learners receive explicit public projections. Requirements use bounded static C normalization without compilation or execution; typedef spellings remain significant. Generated Prisma clients are ignored local artifacts; track schemas/migrations and regenerate through the normal database commands.

Course/bank copies retain independent authoring and private solutions but clear submission enablement and prepared reference selection. Student view remains inspection-only. Teacher review/grading respects course and section staff capabilities; authoring and submission opening require course management. The activity does not advertise a released student-solution capability.

Local acceptance tests use a controlled AI endpoint with real APIs, persistence, queues and browser UI. Native SEB launch is simulated at its boundary; real activation/proof/configuration scoping is tested. See the progress record for actual checks and outstanding work.
