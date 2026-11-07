# Coding Homework submission workflow

**Decision date: November 1, 2026. Status: implemented for local acceptance testing; see the progress record for completed checks.**

This is the canonical record of the user's choices for the next Coding Homework delivery. It supersedes conflicting proposed behavior in the older [implementation plan](CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md), particularly ZIP-only preparation, timing the entire upload/generation workflow, and rejecting every incomplete submission. The [plugin reference](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md) describes the current implementation. No production deployment is implied.

## Implementation clarifications — November 1, 2026

The user approved these follow-up details before implementation:

- C matching checks function name, argument count/types and return type, ignoring parameter names and equivalent pointer/array notation.
- Missing files and signature mismatches, like missing functions, may be submitted after explicit incomplete-work acknowledgement.
- Initially, individual uploads supported destination folders and confirmed replacement at an existing path. The November 3 UI simplification below removes manual folder controls while preserving replacement confirmation.
- Use OpenAI `text-embedding-3-small`; default question-generation concurrency is 2, capped at 4 by the server.
- Material selection is locked while submissions are enabled.
- Deadline finalization submits saved answers, including blanks.
- Teacher cancellation preserves the old record, withdraws its associated grade, and permits a fresh submission with a new question set.
- Material plugins offer their own index generation/refresh service, invoked through core. Plugins never talk directly to sibling plugins.

Remaining reasonable implementation choices are authorized and must be recorded in the [progress record](CODING_HOMEWORK_IMPLEMENTATION_PROGRESS.md) and final report. Validated slices are committed incrementally.

## Model-selection update — November 2, 2026

The user expanded the provider requirement: choose any configured supported model directly in homework, and reuse a saved connection/token across multiple models. The initial delivery placed an embedding selector in Reference materials; the November 6 shared-reference update below moves it to Course settings. Settings retains a separate question-generation selector. The previously approved OpenAI embedding model remains a backward-compatible default, not a provider restriction. OpenAI-compatible/Codex and Ollama embedding APIs are supported; Claude generation requires a separate embedding-capable connection. Changing the generation model does not invalidate indexes. Changing the embedding model requires preparation again, reusing compatible cached vectors. New hand-ins freeze their chosen generation model so later settings changes do not change queued work. Model catalogues are entered manually rather than fetched from providers. See [AI connections](AI_MODEL_CONNECTIONS.md).

## Shared references update — November 6, 2026

The entire reference-material selection/preparation/preview UI belongs to core, activated by an activity capability. Its Reference materials tab has an independent Save/Cancel bar, search, folder expansion, hidden labels and readiness. Generate embeddings is part of this tab. The embedding connection/model is configured once for the course and reused across subscribing activities; the activity retains only its question-generation model. Enabled homework keeps pinned references, while disabled activities must prepare against a changed course model before opening. See [shared reference services](ACTIVITY_MATERIAL_REFERENCES.md).

## Scope

- Support **C** for this delivery, with approximately **30 students submitting at a time**.
- Individual hand-in remains the default. The [November 5 team workflow](TEAM_ACTIVITY_SUBMISSIONS.md) adds shared team preparation/hand-in with individual challenge answers and grades; it supersedes the original individual-only delivery scope and is implemented through core team-assignment services and plugin-owned workspaces.
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

The follow-up clarifications above specify C signature matching and acknowledgement for missing files/signature mismatches. Archive safety failures remain blocking.

## Student file preparation

- Students can upload work **file by file** or as a **ZIP**. As clarified November 3, individual-file uploads use the root and the UI has no destination-folder field or Create folder action. ZIP uploads preserve all valid internal folders.
- A ZIP upload **replaces the whole prepared file collection**; it does not merge with the existing collection.
- Before final submission, students use the same left-tab explorer as submitted work. Each tab has a delete cross, with confirmation. **Remove all files** clears the whole prepared collection, also after confirmation. Students can upload replacements, leave and return later; the selected file reloads when its bytes change. Confirmed changes invalidate the structural check.
- **No in-browser editing of file contents.** Changes to code are made locally and uploaded again. “Change the preparation” means managing uploaded files, not an online code editor.
- Preparing or validating files is separate from **Submit my work** and does not start challenge answering or its countdown. Students explicitly click **Check my submission**; results are hidden until then. A checkmark means structurally valid filenames/functions, not a correct solution. Missing/mismatched requirements are all listed with an error indicator. Submit is shown after a valid check, or after selecting **I want to submit incomplete work** for academic gaps. File changes invalidate the result/acknowledgement. Confirmation warns that submitted work cannot be changed.
- Preparation must persist across visits rather than relying on a browser file-input value or a temporary preflight upload.

The student sees only two resource download buttons when available: the assignment statement and one ZIP of the provided files. Individual attachment names are not listed.

## Final submission and challenge workflow

| Stage | Agreed behavior |
| --- | --- |
| Preparing | The student manages their uploaded collection and reviews validation warnings. |
| Ready to submit | Required incomplete-work acknowledgement has been given, the teacher has enabled final submissions, and activity availability permits the action. |
| Submit my work | Freeze the validated file set. The student can no longer change or withdraw it themselves. Queue challenge generation. |
| Queued/generating | Show an inline spinner and the student’s live position in line while queued; switch to **“Question generation in progress…”** once processing starts. Do not suggest leaving the page. Processing still continues if the student elects to leave, and returning shows the retained status/result. |
| Questions ready | Present **Answer challenge questions**. Readiness alone does not start the answering timer. |
| Answering | Start only after the explicit Answer action and any required SEB handoff/verification. Allow consultation of submitted work read-only and authorized course material. |
| Completed | Retain submitted work, questions, answers and audit evidence for the normal teacher review/grading workflow. |

Students cannot modify the frozen files after confirming and submitting their work. The teacher can **cancel a student's submission from the activity details page** when they decide to permit that student to submit again. The normal teacher enablement switch and activity availability still govern subsequent submission.

Students **must not have a Cancel action for their submitted work or its question-generation job**. Leaving the page is not cancellation. This is an explicit exception to the general request for Cancel on long-running UI: the student generation phase is a persistent status/waiting flow. Teacher-operated preparation/generation actions retain the ordinary cancellation rules where applicable.

Teacher cancellation must be coordinated with queued/running work so a late result cannot revive the cancelled workflow. Retain academic/audit evidence rather than silently deleting it. Cancellation retains the old record, withdraws its associated grade, and permits a new submission with newly generated questions.

## Safe Exam Browser and timing

- Preparation, file validation and final work submission precede the challenge-answering SEB gate.
- If SEB is required and the student is outside a verified session, the first **Answer challenge questions** action opens the appropriate SEB configuration and returns to the same homework page. That page again offers **Answer challenge questions**.
- The answering timer starts on the explicit action that actually begins answering, after the required SEB verification. Opening SEB, uploading files, queueing and question generation do not consume this answering duration.
- If the student is already in SEB with the correct verified configuration for the activity, do not prompt or launch it again. Reuse the platform's verification and activity-scoped authorization, not a browser-name guess.
- The teacher's activity time limit is optional and governs the answering phase when configured.
- The existing **activity availability settings remain a hard learner access/start boundary**. A ready question set does not authorize starting an unavailable activity later, such as returning 24 hours afterwards. No additional fixed 24-hour grace period was requested.
- Students can consult **their submitted files read-only** while answering. Use the shared left-tab view, automatically open the first file, and show its contents on the right aligned with the first tab. Keep filenames in the tabs without repeating a filename or file size above the content. **Course material remains accessible**, subject to its normal permissions, including during SEB use.
- Queue-related grace periods, automatic deadline extensions and special treatment of work becoming ready after closing are deferred. The teacher is responsible for suitable availability and duration settings in this phase. Do not invent an exception to the configured window.

At timeout, finalize the server-saved answers, including blanks. Do not accept new answer content after expiry or invent an availability extension.

### Answer submission confirmation — November 3, 2026

Students may submit unanswered questions, including an entirely blank set. **Submit answers** first opens the shared confirmation with an explicit warning that answers cannot be changed after submission. If answers are missing or contain only whitespace, list their displayed numbers (for example, “Question 1” and “Question 3”); do not require them to be filled. Cancel returns to editing without submitting. The automatic deadline path bypasses confirmation and closes an open confirmation when the attempt completes. Student operation errors use the notification system and its history instead of a duplicate page-top message.

## Question content and language — November 2, 2026

Each challenge shows the relevant function code from the student's frozen submission, with its filename and function name, beside the answer area. It is read-only; private reference code and teacher instructions are never included. For incomplete/unparseable work, show the submitted-code context used by generation. Bounded excerpts indicate truncation and the complete submitted files remain available.

The November 3 presentation refinement gives each question a separate numbered card. The prompt precedes the code, and code/answer appear side by side where space permits, stacked otherwise. Long code stays inside its own scrollable frame; the next question begins with a clearly separated header. Existing questions and saved answers use the same improved presentation.

Teachers enter private AI question-generation instructions in the homework Settings tab and save them with the activity. These are authoritative generation policy, not ordinary evidence or grading notes. Questions use the course Subject's teaching language, never the student/session UI locale. Language and instructions are frozen for each new hand-in so later settings changes cannot split an existing question set. Existing questions retain their wording and gain available code context without being regenerated.

## Challenge difficulty and expected answers — November 3, 2026

Challenges assess understanding of the student's own submitted code, with a complete answer of about **2–3 sentences**. They must be reasonable for someone who actually wrote that code at the course's level. Use varied focused questions: a small concrete case or relevant valid boundary input and why the result makes sense; why a condition/guard exists; or another local implementation choice. These examples are not the only permitted forms. Avoid obscure traps, long traces, broad multi-part questions and unavailable context. Do not presume incorrect code is correct. This is a question-design target, not an automatic limit on student answers.

## Provided-code exclusion — November 3, 2026

Do not ask about unchanged code explicitly provided by the teacher. Compare individual C/H files and C/H entries in provided ZIPs, ignoring folders, formatting and comments. A changed implementation token, including a literal, remains eligible. The private solution is not used for this comparison. Filter before candidate limits so early starter functions cannot crowd out student-written code.

Questions may mention provided helpers when asking how the student's own function calls them or checks their result. The helper's internal implementation remains excluded; mentioning its name alone must not invalidate an otherwise suitable question. Correction retries preserve the code context and explain what was rejected, while retaining the course language and short-answer scope.

Hand-in records a compact manifest of hashes/function names, **not a copy of the provided files per submission**. Cache parsing by attachment version; queued submissions use their frozen manifest after later teacher changes. Older queued work uses current provided files once because no historical manifest exists. Existing completed questions stay unchanged. If no eligible function can be identified in a submission containing provided functions, show a clear teacher-review state without calling AI or falling back to starter-code questions. This is an explicit refinement of the original incomplete-code fallback assumption. See [comparison details](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md#excluding-unchanged-provided-code).

## Queue and load control

- Use a **FIFO dispatch queue** for challenge generation rather than launching every student's AI requests at once.
- Permit limited parallel processing, with **the teacher choosing how many submissions may be processed at once** within a server-enforced safe maximum.
- The approved default is 2 concurrent submissions, with a server-enforced maximum of 4. Validate the bound across workers; 30 students must never become 30 parallel generation jobs.
- With parallelism, FIFO refers to admission/dispatch order; independent jobs need not finish in arrival order.
- Persist jobs and status across browser departure. Submission retries must not create duplicate work, and teacher cancellation must remain effective against late worker responses.
- The target class represents roughly **90–150 generated questions** at the expected 3–5 questions per student. Validate queue behavior at that scale locally/preprod.
- Implementation choice: three generation attempts with bounded backoff; leases heartbeat every 15 seconds and recover after two minutes of inactivity. Terminal failure retains frozen work; a teacher can cancel and permit resubmission.

## Material selection, indexing and reuse

- The teacher chooses course materials to use as question-generation references.
- By default select **visible course material before the Coding Homework activity in course-content order**. Hidden material is offered but unchecked by default, including material inside hidden folders.
- Checking a folder explicitly includes **all material within it, recursively**, including hidden material.
- The teacher explicitly runs **Generate embeddings** before being allowed to enable final submissions.
- Changing the selection requires rebuilding/validating the homework's prepared reference selection before enabling submissions. Reuse existing compatible vectors; generate only missing, changed or stale embeddings.
- Do not pay to generate another embedding for unchanged, compatible material merely because a different Coding Homework selects that same material.
- The material-selection UI should expose which selected sources are ready for reuse and which need generation/refresh, including repository freshness. This was requested as part of understanding what needs preparation.
- Teachers can inspect the saved indexed text from Reference materials, including the exact pinned version for prepared homework. Obvious unreadable link shells must fail before embedding generation; indexing does not establish complete pedagogical coverage of arbitrary websites. The preview is read-only and makes no model calls.
- Once final submissions are enabled, **do not regenerate embeddings for that enabled workflow**. Keep the prepared reference/index version stable even if a shared cache is later rebuilt for another homework. Pinning references must preserve reuse without letting another activity's refresh change an active workflow.
- Content-type plugins own source extraction and source-specific freshness settings; shared platform services own reusable vector indexing/search. The homework plugin consumes those contracts and retains its reference selection/snapshots, without implementing its own course-material vector store.

### Initial material formats

Required sources for this delivery are **PDFs, links and public GitHub repositories**, alongside the platform's existing course-material selection. Uploaded ZIP references also support source/text files through the owning File plugin; executable-only or unreadable archives fail explicitly. See the bounded extraction rules in [material services](MATERIAL_EMBEDDING_SERVICES.md).

The user supplied this lecture/slides link as a required example of linked teaching material:

- [INF155 course 04 slides](https://anisboubaker.github.io/INF155/diapos/cours04/#/)

The supplied deck was verified with the real link extractor during local acceptance (static teaching content, including slide templates). Supporting a link means obtaining useful teaching content for retrieval, not merely embedding the URL. Public repository support likewise requires repository contents, not a URL-only placeholder. Private GitHub repositories are out of scope for now. Exact branch/path selection, link traversal, and any scanned-PDF/OCR requirements remain implementation details to resolve.

### GitHub freshness

- The freshness interval is a setting owned by the **GitHub material plugin**.
- Its default is **48 hours**, and the teacher can change it **per repository material**.
- Check the selected repository's freshness **when enabling final submissions**, using that repository's configured interval.
- A stale repository must be refreshed before enablement can proceed.
- Do not continuously expire or regenerate indexes during the enabled submission workflow. The 48-hour rule is not a per-student submission check.

### Models and index compatibility

- **OpenAI** was the initial provider choice; the November 2 update permits any configured supported provider for generation and any configured embedding-capable provider for indexing.
- **`text-embedding-3-small`** remains the legacy embedding default. Teachers can select another embedding model independently of question generation.
- **Changing the question-generation model must not invalidate existing indexes.** The indexes provide vector retrieval context to question generation; they do not depend on which generation model consumes that context.
- Embedding compatibility remains tied to the actual embedding configuration and source revision. Reuse unchanged compatible embeddings; a genuinely different embedding model/dimension configuration cannot be treated as the same index.
- Embedding dimensions are native to the selected model, bounded at 8192; legacy default vectors retain 1536 dimensions. Stored vectors and query configuration must match.

## Recorded implementation assumptions and deferred work

- Static matching uses a bounded C scanner, without preprocessing or compilation. Typedef spelling remains significant; syntax incompleteness can be acknowledged, while parser resource limits block.
- The teacher can configure 1–20 questions (default 3). Reuse eligible functions for distinct questions if fewer functions exist. Incomplete-source fallback is limited to cases without parsed submitted/provided functions and must omit unchanged provided sources. This is not an automatic correctness score.
- Individual files are limited to 8 MB; the prepared collection obeys the configured archive-size/file-count ceilings. ZIP replacement and same-path overwrites require confirmation. Empty reference selection must be explicitly prepared and uses assignment/submitted work for generation.
- Reference selection contains shared course material resources, including hidden resources labelled as hidden and unchecked by default. Section-only materials and activity prompts that are not material resources are excluded from the chooser. A folder selects its current recursive material descendants. Private teacher solutions are never automatically embedded.
- Use OpenAI 1536-dimensional vectors in PostgreSQL Float32 storage and bounded exact cosine search, without a new database image/extension. Reuse vectors/indexes across homework. See [material services](MATERIAL_EMBEDDING_SERVICES.md) for compatibility and limits.
- Public GitHub root repositories use the default branch pinned to a commit; no branch/subdirectory chooser, private credentials, checkout or execution. Extraction is bounded to 200 source/text files, 512 KB each and 4 MB total. Repository freshness allows 1–8760 hours, default 48.
- Link extraction reads static HTML/plain text and Reveal.js inline/same-origin external Markdown, without executing JavaScript. PDFs must contain extractable text; Poppler is required, and OCR/Word/PowerPoint are deferred.
- Teacher cancellation preserves the original evidence and grants a new workflow rather than changing frozen files. A replacement after released grading is scoped to that student; whole-class release remains unchanged.
- Native SEB startup is simulated at the OS boundary in Playwright. Real launch-token/configuration proof, session scoping and no-repeat-launch behavior are tested. A final native-client check remains an operator acceptance step.

## Same-course duplication — November 4, 2026

Duplicating a homework within its course preserves its authored content/files/private solution, requirements, AI instructions and model choices, question settings and concurrency. It keeps the same course-reference selection and prepared indexes: the subject/material context is unchanged. The copy owns an independent prepared-reference snapshot and reuses immutable embeddings without regenerating them. An untouched default selection is resolved at the original placement before copying, rather than recalculated from the duplicate's position.

Reset course delivery state: section/student assignments and exceptions, availability, time limits, SEB, attempt policy and submission opening. Do not copy student drafts, submissions, answers, jobs or grades. The Homework Grader plugin owns its data-copy rules behind the generic lifecycle hook; see [duplication details](../packages/plugin-activities/plugin-coding-homework-grader/docs/REFERENCE.md#duplication-within-a-course).

## Implementation status and acceptance

The current implementation contains the preparation, private solution, static signature acknowledgement, prepared-reference/manual-opening, durable queue, deferred SEB/timer and cancellation workflow described above. The [progress record](CODING_HOMEWORK_IMPLEMENTATION_PROGRESS.md) records incremental commits, actual local tests and any remaining final checks.

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

No production browser tests, synthetic production submissions or deployment are authorized by this implementation task.

## File hand-in deadline and lateness — November 5, 2026

Homework Settings has an optional **Submission deadline**, entered as a date/time in the effective course timezone and stored as UTC. No deadline preserves the existing manual-switch workflow. **Allow late submissions** defaults off. When enabled, lateness may be unlimited or bounded by a positive days/hours/minutes duration measured from the deadline. Duration days are elapsed 24-hour periods; the server caps the configurable duration at 3650 days. The late cutoff is exclusive, as is the ordinary deadline when lateness is disallowed.

This is a file hand-in deadline. It does not automatically open submissions or override course/activity availability, SEB, attempt limits, or the challenge answering timer. Prepared files remain readable; uploads, replacements and removals stop at a finite cutoff. Students see the deadline/late cutoff and automatic recovery status. The server checks its own clock under the homework settings/workflow locks and rechecks after validation before freezing new work. A retry of an already accepted hand-in remains idempotent. Teachers can extend the policy without rewriting existing submissions.

Every new hand-in retains its accepted timestamp, deadline snapshot, late flag and exact delay in milliseconds. Students, the teacher submission list and Review and grade show **Late by …**, formatted as days/hours/minutes (seconds below one minute). Later deadline changes cannot reclassify prior work. A team’s members, including late joiners, inherit the original shared hand-in timing; individual challenge resets retain it. No automatic grade penalty is introduced. Same-course duplication copies this authored policy while leaving submissions disabled; bank transfers clear it with other course workflow settings.

## Automatic file hand-in and verification notice — November 5, 2026

When late submission is disallowed, a nonempty prepared collection is automatically handed in at the submission deadline. When late work has a bounded duration, it is handed in at the end of that grace period. With no deadline or unlimited late work, there is no automatic hand-in. Final submissions must be enabled with prepared references. Recovery runs on the learner’s workspace read (including the open page’s poll) and the authorized activity Class overview management read; ordinary editor management reads do not trigger class recovery.

Automatic hand-in validates the saved files and accepts academic gaps as an incomplete-work acknowledgement. Retain the result and record that the acknowledgement was automatic, not a learner click. Archive/path/resource limits and file integrity are never bypassed; report an unsafe/unreadable copy and continue recovering other copies. Empty drafts create no submission. Current enrollment/team authorization still applies. Teacher class recovery can freeze previously saved work after learner availability closes; it does not reopen learner access or start the challenge timer.

Use the cutoff as the effective hand-in time and retain the actual recovery time/actor separately. No-late deadline recovery is on time; bounded-grace recovery is late by the grace duration, never by the time until someone opens the page. Concurrent or repeated visits reuse the existing hand-in and queued questions. A teacher cancellation at/after the cutoff is respected until a later deadline is set. If a deadline is backdated before the draft’s last accepted file change, report the mismatch instead of claiming those files existed at that cutoff.

After verification, prominently state **Your work has not been submitted**, explain that verification only checks structure, and name **Submit my work** as the action to submit now. For finite cutoffs, separately explain automatic hand-in of any remaining saved files. A receipt distinguishes automatic hand-in and automatic acceptance of incomplete work.

## Explicit hidden references — November 6, 2026

Teachers may explicitly include hidden course material in the Reference materials picker. Inherited folder visibility counts as hidden; default prior-material selection excludes it, even while a hidden activity is being authored. Explicit folder selection includes all descendant resources. Saved selections persist rather than being reset on reload. Selection does not change course-content visibility.

Preparing references records the exact hidden index subset and the preparing manager. Background question generation searches those indexes through core under that manager’s current authorization, while visible/legacy references retain learner scope. Missing/inactive preparers, revoked management permission or indexes outside the pinned selection fail closed. Hidden text is private AI context, never student document access or question-payload provenance; the prompt prohibits quoting reference excerpts. Same-course duplication retains index IDs and establishes the copying manager as the private-reference preparer. Material extraction remains owned by the material plugins through core.
