# Coding Homework Grader Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Assignment PDFs and provided files are activity-owned plugin attachments, not course content resources.
- Consume prior content only through generic content-type extraction and vector-search dispatchers. Never branch on concrete content types here.
- The parser registry is language-neutral; C is the first conservative adapter. Add languages through adapters, not pipeline branches.
- ZIP preflight creates temporary plugin records only. A mode-tagged core attempt is created after every challenge answer is finalized, not at upload time; formative attempts remain review-only and summative attempts are gradeable.
- Student view is inspection-only for this plugin until an expiring non-academic upload workspace exists; never emulate preview by creating and deleting normal preflight/submission records.
- Final-submission processing is idempotent, background-job based, append-audited, and replace-on-reprocess for derived functions/questions.
- Released teacher-entered grades/feedback are challengeable through core; review must return to the plugin's existing manual-grading surface and audited override path.
- Teacher submission review and grading consume core course capabilities: explicit course teachers/admins work course-wide, while section teachers/TAs are restricted to their assigned groups. Assignment authoring, snapshots, and grade release remain course-management operations.
- Student-triggered challenge generation resolves only explicit course staff question-authoring preferences in creator, owner, then teacher order; disabled, missing, unauthorized, or keyless non-local connections are skipped before the request fails safely.
- Student challenge payloads are sanitized; generation prompts, raw output, reference matches, provider keys, and provenance remain private.
- Bank duplication and synchronization must include assignments, requirement sets, and attachment rows while immutable physical files may be shared.
- Production code must not import or execute the research prototype under `tmp/`.
- Plugin authoring uses one guarded draft; independently persisted uploads and processing actions are outside its saved-status claim.
