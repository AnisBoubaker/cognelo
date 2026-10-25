# Coding Homework Grader Memory

- Learner payloads use the definition’s allowlisted `studentConfig`; keep keys, solutions, private instructions, and authoring metadata server-side. See [learner data boundaries](docs/REFERENCE.md#learner-data-boundaries).
Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Assignment PDFs and provided files are activity-owned plugin attachments, not course content resources.
- Consume prior content only through generic content-type extraction and vector-search dispatchers. Never branch on concrete content types here.
- The parser registry is language-neutral; C is the first conservative adapter. Add languages through adapters, not pipeline branches.
- ZIP preflight creates temporary plugin records only. A valid final ZIP reserves a mode-tagged core attempt atomically with plugin records; final answers submit that same attempt, and only one unfinished workflow is permitted; formative attempts remain review-only and summative attempts are gradeable.
- When course assignment timing is enabled, core creates that attempt at the explicit timed start and the plugin's final challenge-answer route reuses it. `TimedActivityAutoSubmit` finalizes only a complete ready question set; otherwise core records the timeout as an ungraded attempt without inventing a plugin submission result. Until submission, core refreshes the effective deadline from the original start; keep response state intact during policy refresh. Core resolves [team/student exceptions](../../../docs/ACTIVITY_ASSIGNMENT_EXCEPTIONS.md); reuse its effective context and grading services rather than querying team policy inside the plugin.
- The definition declares `studentView: { mode: "read_only" }` until an expiring non-academic upload workspace exists; never emulate preview by creating and deleting normal preflight/submission records.
- Final-submission processing is idempotent, background-job based, append-audited, and replace-on-reprocess for derived functions/questions.
- The teacher gradebook-attempt route accepts an exact final-submission ID constrained by activity, group, participant-linked user, and the matching core attempt. The host uses it for newest-first lazy history; older and formative submissions are inspection-only.
- Released teacher-entered grades/feedback are challengeable through core only when the effective summative assignment setting permits it; review must return to the plugin's existing manual-grading surface and audited override path.
- Teacher submission review and grading consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Assignment authoring, snapshots, and grade release remain course-management operations.
- Student-triggered challenge generation resolves only explicit course staff question-authoring preferences in creator, owner, then teacher order; disabled, missing, unauthorized, or keyless non-local connections are skipped before the request fails safely.
- Student challenge payloads are sanitized; generation prompts, raw output, reference matches, provider keys, and provenance remain private.
- Bank duplication and synchronization must include assignments, requirement sets, and attachment rows while immutable physical files may be shared.
- Production code must not import or execute the research prototype under `tmp/`.
- Plugin authoring uses one guarded draft; independently persisted uploads and processing actions are outside its saved-status claim.

- [Submission continuation](../../../docs/SUBMISSION_CONTINUATION.md): Reopens the existing challenge answers while retaining the uploaded ZIP and generated questions. Prior mutable completion evidence is audited; final answers submit through the same core attempt without regenerating questions. Restore through the host transaction; reopening preserves the original start and applies current exceptions.

- Display timestamps through the shared application-time context (the effective course zone within course pages) and explicit-zone formatters; the browser timezone is not a user preference. See [Application time](../../../docs/APPLICATION_TIME.md).

- Honor the host [activity content closure policy](../../../docs/ACTIVITY_CONTENT_ACCESS.md) for prompts, histories, solutions, and files. Final submission may return a host-handled closure signal instead of a review payload; preserve records and finalization cleanup.

- Reuse `ActionIcon` from `@cognelo/activity-ui` and the shared [action-button rules](../../../docs/ACTION_BUTTONS.md); keep localized labels and action semantics, without plugin-local SVG/emoji substitutes.

- [Answer exports](../../../docs/ANSWER_EXPORTS.md) are read-only plugin projections: Exports read retained submitted text/source files and challenge answers, with optional assignment Markdown/PDF, question text, and teacher comments. Binary files remain identified attachments; no analysis or question generation is run.

- Keep ZIP directory/expansion limits, upload/storage budgets, staff-only internal analysis, and atomic finalization together. Expiry finalizes saved answers only; no new archive is accepted after the deadline. See [upload boundaries](docs/REFERENCE.md#upload-and-finalization-boundaries).

- Use the shared Markdown renderer for prompts and feedback: raw styles/forms/attributes stay inert and math stays untrusted and bounded. See [the shared rendering contract](../../../docs/plugin-authoring/03-core-services.md#what-markdownrenderer-gives-you).
