# Coding Homework submission workflow

**Decision date: November 1, 2026. Status: approved product requirements; implementation and validation are pending.**

This is the canonical record of the user's choices for the next Coding Homework delivery. It supersedes conflicting proposed behavior in the older [implementation plan](CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md), particularly ZIP-only preparation, timing the entire upload/generation workflow, and rejecting every incomplete submission. The [plugin reference](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md) describes the existing implementation; this document does not claim these changes have shipped.

## Scope

- Support **C** for this delivery, with approximately **30 students submitting at a time**.
- Students may work in teams outside the system, but **each student submits the team's work individually** and has an individual challenge workflow. Shared/team submissions are out of scope for now.
- Expect **3–5 challenge questions per student**. The teacher configures the question count; this expected range is not an agreed hard minimum/maximum.
- Validate statically. Do not compile or run student programs, execute automated correctness tests, or add automatic functional grading in this phase.
- Final-submission opening is controlled by a **manual teacher switch**. Automatic scheduling of that switch is out of scope for now. The original 9 a.m. example is a teacher-operated workflow, not a universal start time.
- The precise course/activity and go-live deadline have not been specified. Do not turn “next week” into an invented date.

## Teacher solution and submission requirements

1. The teacher uploads their solution.
2. The system inspects that C source to offer functions for requirement selection.
3. The teacher handpicks the functions students must provide. A **Select with AI** option assists that selection.
4. Submission validation checks the expected **file names**, then whether the selected required functions exist with the **correct arguments**.
5. If some required functions are missing, show a clear warning and require the student to explicitly acknowledge that they are submitting **incomplete work**. Missing a couple of functions must not automatically prevent submission.

The teacher solution remains a private authoring artifact under the existing teacher-only data boundary. It is distinct from files explicitly provided to students. Uploading it does not authorize exposing it in the student's file viewer.

Record the validation result and incomplete-work acknowledgement against the submitted file set. Replacing/removing files invalidates a prior validation result; final submission must validate the actual collection being frozen. Existing archive safety, authorization, and storage limits remain enforced independently of the incomplete-work acknowledgement.

Exact C signature compatibility rules and the treatment of missing files or incorrect signatures still need specification; see [remaining details](#remaining-details-and-deferred-work).

## Student file preparation

- Students can upload work **file by file** or as a **ZIP**.
- A ZIP upload **replaces the whole prepared file collection**; it does not merge with the existing collection.
- Before final submission, students can remove uploaded files, upload replacements, leave the page, return later, and continue preparing the collection.
- **No in-browser editing of file contents.** Changes to code are made locally and uploaded again. “Change the preparation” means managing uploaded files, not an online code editor.
- Preparing or validating files is separate from **Submit my work** and does not start challenge answering or its countdown.
- Preparation must persist across visits rather than relying on a browser file-input value or a temporary preflight upload.

## Final submission and challenge workflow

| Stage | Agreed behavior |
| --- | --- |
| Preparing | The student manages their uploaded collection and reviews validation warnings. |
| Ready to submit | Required incomplete-work acknowledgement has been given, the teacher has enabled final submissions, and activity availability permits the action. |
| Submit my work | Freeze the validated file set. The student can no longer change or withdraw it themselves. Queue challenge generation. |
| Queued/generating | Show **“Question generation in progress…”**. Processing continues if the student leaves the page. Returning shows the retained status/result. |
| Questions ready | Present **Answer challenge questions**. Readiness alone does not start the answering timer. |
| Answering | Start only after the explicit Answer action and any required SEB handoff/verification. Allow consultation of submitted work read-only and authorized course material. |
| Completed | Retain submitted work, questions, answers and audit evidence for the normal teacher review/grading workflow. |

Students cannot modify the frozen files after confirming and submitting their work. The teacher can **cancel a student's submission from the activity details page** when they decide to permit that student to submit again. The normal teacher enablement switch and activity availability still govern subsequent submission.

Students **must not have a Cancel action for their submitted work or its question-generation job**. Leaving the page is not cancellation. This is an explicit exception to the general request for Cancel on long-running UI: the student generation phase is a persistent status/waiting flow. Teacher-operated preparation/generation actions retain the ordinary cancellation rules where applicable.

Teacher cancellation must be coordinated with queued/running work so a late result cannot revive the cancelled workflow. Retain academic/audit evidence rather than silently deleting it. The precise handling of existing completed answers/grades and the subsequent attempt identity is not yet decided.

## Safe Exam Browser and timing

- Preparation, file validation and final work submission precede the challenge-answering SEB gate.
- If SEB is required and the student is outside a verified session, the first **Answer challenge questions** action opens the appropriate SEB configuration and returns to the same homework page. That page again offers **Answer challenge questions**.
- The answering timer starts on the explicit action that actually begins answering, after the required SEB verification. Opening SEB, uploading files, queueing and question generation do not consume this answering duration.
- If the student is already in SEB with the correct verified configuration for the activity, do not prompt or launch it again. Reuse the platform's verification and activity-scoped authorization, not a browser-name guess.
- The teacher's activity time limit is optional and governs the answering phase when configured.
- The existing **activity availability settings remain a hard learner access/start boundary**. A ready question set does not authorize starting an unavailable activity later, such as returning 24 hours afterwards. No additional fixed 24-hour grace period was requested.
- Students can consult **their submitted files read-only** while answering. **Course material remains accessible**, subject to its normal permissions, including during SEB use.
- Queue-related grace periods, automatic deadline extensions and special treatment of work becoming ready after closing are deferred. The teacher is responsible for suitable availability and duration settings in this phase. Do not invent an exception to the configured window.

The user did not select a new partial-answer timeout/finalization policy. Preserve that as an explicit outstanding detail rather than assuming automatic submission of blank answers or automatic extensions.

## Queue and load control

- Use a **FIFO dispatch queue** for challenge generation rather than launching every student's AI requests at once.
- Permit limited parallel processing, with **the teacher choosing how many submissions may be processed at once** within a server-enforced safe maximum.
- The maximum must be chosen to suit the servers and provider limits. No numeric default or ceiling was approved; sizing and verification are implementation work, not permission to allow 30 parallel jobs.
- With parallelism, FIFO refers to admission/dispatch order; independent jobs need not finish in arrival order.
- Persist jobs and status across browser departure. Submission retries must not create duplicate work, and teacher cancellation must remain effective against late worker responses.
- The target class represents roughly **90–150 generated questions** at the expected 3–5 questions per student. Validate queue behavior at that scale locally/preprod.
- Exact automatic retry/backoff and terminal-error recovery policy was not settled in the answers. Existing retry behavior is a baseline to inspect, not a newly approved guarantee.

## Material selection, indexing and reuse

- The teacher chooses course materials to use as question-generation references.
- By default select **all course material before the Coding Homework activity in course-content order**.
- Checking a folder includes **all material within it, recursively**.
- The teacher explicitly runs **Generate embeddings** before being allowed to enable final submissions.
- Changing the selection requires rebuilding/validating the homework's prepared reference selection before enabling submissions. Reuse existing compatible vectors; generate only missing, changed or stale embeddings.
- Do not pay to generate another embedding for unchanged, compatible material merely because a different Coding Homework selects that same material.
- The material-selection UI should expose which selected sources are ready for reuse and which need generation/refresh, including repository freshness. This was requested as part of understanding what needs preparation.
- Once final submissions are enabled, **do not regenerate embeddings for that enabled workflow**. Keep the prepared reference/index version stable even if a shared cache is later rebuilt for another homework. Pinning references must preserve reuse without letting another activity's refresh change an active workflow.
- Content-type plugins own source extraction and source-specific freshness settings; shared platform services own reusable vector indexing/search. The homework plugin consumes those contracts and retains its reference selection/snapshots, without implementing its own course-material vector store.

### Initial material formats

Required sources for this delivery are **PDFs, links and public GitHub repositories**, alongside the platform's existing course-material selection.

The user supplied this lecture/slides link as a required example of linked teaching material:

- [INF155 course 04 slides](https://anisboubaker.github.io/INF155/diapos/cours04/#/)

Retain the example as an extraction/acceptance fixture; this documentation change does not validate its extraction. Supporting a link means obtaining useful teaching content for retrieval, not merely embedding the URL. Public repository support likewise requires repository contents, not a URL-only placeholder. Private GitHub repositories are out of scope for now. Exact branch/path selection, link traversal, and any scanned-PDF/OCR requirements remain implementation details to resolve.

### GitHub freshness

- The freshness interval is a setting owned by the **GitHub material plugin**.
- Its default is **48 hours**, and the teacher can change it **per repository material**.
- Check the selected repository's freshness **when enabling final submissions**, using that repository's configured interval.
- A stale repository must be refreshed before enablement can proceed.
- Do not continuously expire or regenerate indexes during the enabled submission workflow. The 48-hour rule is not a per-student submission check.

### Models and index compatibility

- **OpenAI** is the chosen provider for the initial implementation.
- The user requested “use the same model,” but did not identify a concrete embedding model or dimensions. Do not silently turn that phrase into a model ID or assert that the question-generation model is an embedding endpoint.
- **Changing the question-generation model must not invalidate existing indexes.** The indexes provide vector retrieval context to question generation; they do not depend on which generation model consumes that context.
- Embedding compatibility remains tied to the actual embedding configuration and source revision. Reuse unchanged compatible embeddings; a genuinely different embedding model/dimension configuration cannot be treated as the same index.
- The exact embedding model/endpoint and dimension/storage choices remain explicit technical choices before implementation. No model/pricing/provider-capacity claim is made here.

## Remaining details and deferred work

These were not resolved by the user's answers and must not be silently filled in as approved product decisions:

1. Exact C argument/signature matching: parameter count/types, pointer/array normalization, qualifiers, parameter names and return-type requirements.
2. Whether missing required files and signature mismatches are blocking or acknowledgement-based; how to generate the configured number of questions when too little analyzable code or too few required functions are present.
3. Folder/path handling for individual uploads and duplicate-name replacement behavior. ZIP replacement of the entire collection is already decided.
4. The exact OpenAI embedding model configuration; generation-model changes must not invalidate indexes regardless of that choice.
5. The teacher parallelism default and server-wide safety ceiling, including coordination across workers and concurrent activities. The engineering choice must be justified by capacity/rate-limit validation.
6. Whether material selection can be edited while final submissions are enabled or must first be disabled. No regeneration within an enabled workflow is approved.
7. Teacher cancellation semantics after answers or grades already exist, reuse versus creation of a core attempt, and retry/recovery behavior after terminal generation failures.
8. Partial-answer handling at time expiry. Queue/grace-period special cases are expressly deferred; no automatic availability extension is approved.
9. Whether hidden/section-specific materials or earlier activity statements can be selected, and how activity-owned assignment/provided files or the new private teacher solution join the explicit reference set.
10. Additional extraction details beyond the specified source types: repository branch/subdirectory scope, link crawling depth and scanned-PDF/OCR support. No Word/PowerPoint or private-repository requirement was selected.

## Implementation status and acceptance

The current baseline already contains ZIP preflight/final uploads, C function-name analysis, a background generation pipeline, saved challenge answers, manual grading, prior-material snapshots and deterministic development vector indexes. It does **not** yet implement the full target above. In particular, file-by-file persistent preparation, solution-derived argument validation and acknowledgement, manual submission enablement with indexing readiness, phase-specific SEB/timing, real repository/content embeddings and the per-repository freshness setting require implementation or integration work.

The [implementation plan](CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md#approved-next-delivery) tracks that work. Before declaring this ready, validate locally or in isolated preprod:

- Individual uploads, whole-collection ZIP replacement, deletion/re-upload and persistence after leaving/reloading; no content editor.
- Required-file/function/argument checks and explicit incomplete-work acknowledgement against the final frozen collection.
- Teacher-only manual enablement and solution/requirement selection; no premature final submissions.
- Immutable student submissions and teacher-only cancellation/resubmission permission.
- Durable FIFO processing, teacher concurrency limits, browser departure, worker failure/recovery and suppression of late results after teacher cancellation.
- Default prior-material selection, recursive folder selection, reusable indexes and readiness invalidation after selection changes.
- Actual PDF/link/public-repository content extraction, with the supplied lecture link included in acceptance coverage.
- GitHub 48-hour default and per-repository override checked at enablement only; no regeneration during the enabled workflow.
- Independent question-model changes without reindexing; exact compatible embedding reuse across homework activities.
- Correct SEB handoff, no duplicate launch for verified sessions, read-only submitted-code access and continued material access.
- Timer start on Answer, enforcement of activity availability, preserved answers and staff review/audit access.

No production browser tests or synthetic submissions are authorized by this plan. This documentation commit changes no runtime behavior, schema, models, deployment or configuration.
