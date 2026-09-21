# Plugin: Coding Homework Grader

`@cognelo/plugin-coding-homework-grader` provides the `coding-homework-grader` activity type for ZIP-based programming assignments. It supports teacher assignment/files/requirements authoring, prior-course documentation snapshots, ZIP validation, C function analysis, generated challenge questions, student answers, core attempts, and teacher manual grading.

## Workflow

```text
author assignment -> snapshot prior content -> validate ZIP -> analyze functions
-> generate challenge questions -> collect answers -> submit core attempt -> review grade
```

Long-running analysis and question generation use the shared background-job service. Final submission requests are idempotent and teachers can reprocess unfinished or failed work.

## Read By Topic

- [Current capabilities and phase summary](docs/REFERENCE.md#current-state)
- [Authoring, snapshots, extraction, and persistence](docs/REFERENCE.md#implementation-direction)
- [Durable data and processing decisions](docs/DECISIONS.md)
- [Full phased design and open decisions](../../../docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md)

Load only the topic relevant to the change.

## Boundaries

- Assignment files and submissions are plugin-owned attachments.
- Prior course resources are extracted and searched through core/content-type dispatchers; this plugin does not own content-type extraction or a private course-content vector store.
- Student payloads never expose model prompts, nearest examples, reference provenance, credentials, or raw output.
- Bank and course authoring rows are independent and synchronized through explicit hooks.

When behavior changes, update this overview, `PROJECT_MEMORY.md` only if an invariant changed, and the relevant detailed section or implementation plan.
