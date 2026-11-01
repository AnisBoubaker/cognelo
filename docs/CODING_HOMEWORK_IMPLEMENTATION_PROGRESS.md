# Coding Homework implementation progress

This is the resumable work record requested by the user. It complements the [product specification](CODING_HOMEWORK_SUBMISSION_WORKFLOW.md) and must be updated at each validated implementation slice.

## Objective and authorization

Implement the agreed Coding Homework workflow for local testing: C, 30 individual students, persistent file/ZIP preparation, static solution-derived requirements, manual submission opening after reference preparation, immutable work, queued question generation, explicit SEB/timed answering, read-only source consultation, and teacher cancellation/resubmission. Do not deploy or test production.

The user explicitly authorized reasonable remaining assumptions and requested them in the final report. Commit validated slices along the way rather than one huge final commit. Do not stop after a partial implementation merely because a slice is complete.

## Confirmed follow-up choices — November 1, 2026

- Match C function name, argument count/types and return type; ignore parameter names and equivalent pointer/array notation.
- Missing files, missing functions and signature mismatches require explicit incomplete-work acknowledgement rather than blocking solely for incompleteness. Safety/authorization limits remain hard failures.
- Individual uploads support destination folders and confirmed replacement at the same path. ZIP replaces the entire prepared collection.
- OpenAI `text-embedding-3-small` for embeddings; question-generation model changes do not invalidate indexes.
- Question-generation concurrency defaults to 2, with a server-enforced maximum of 4.
- Lock material selection while submissions are enabled.
- At the answering deadline submit saved answers, including blanks.
- Teacher cancellation retains the old record, withdraws its associated grade, and permits a new submission with newly generated questions.
- Material plugins own generation/refresh of their indexes as a service. All inter-plugin requests are routed through core; never import a sibling material plugin from homework.

## Checklist

- [x] Record authorization, clarifications and recovery checklist.
- [ ] Static C signature validation and private teacher-solution/function selection.
- [ ] Persistent upload collection, ZIP replacement, validation acknowledgements and frozen hand-in.
- [ ] Core-dispatched material-plugin indexing services, OpenAI embeddings, immutable reusable indexes and freshness.
- [ ] Source selection/readiness/manual enablement; public GitHub, PDF, text and linked slides extraction.
- [ ] Durable bounded FIFO processing, restart/retry/cancellation protection and correct question counts.
- [ ] Deferred SEB/timed answering through shared contracts; deadline finalization and teacher cancellation.
- [ ] Complete teacher/student UI and localized states; read-only submitted files and accessible course materials.
- [ ] Unit, type, architecture and local Playwright integration checks, including bounded concurrent processing.
- [ ] Documentation review, operator notes and final runnable local handoff.

## Assumptions to report

None chosen beyond the confirmed settings yet. Add each substantive implementation choice here when made.

## Current checkpoint

- Baseline: documentation commit `d67e1ea`; working tree was clean before this task.
- Implementation has started with discovery and this checkpoint. No runtime changes yet.
- Resume by reading this file and the current Git diff; do not redo completed work.

## Validation and commits

- Documentation checkpoint: pending commit after link review.
