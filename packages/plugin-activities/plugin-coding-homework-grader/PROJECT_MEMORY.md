# Coding Homework Grader Memory

Read [docs/DECISIONS.md](docs/DECISIONS.md) only for the area being changed.

- Assignment PDFs and provided files are activity-owned plugin attachments, not course content resources.
- Consume prior content only through generic content-type extraction and vector-search dispatchers. Never branch on concrete content types here.
- The parser registry is language-neutral; C is the first conservative adapter. Add languages through adapters, not pipeline branches.
- ZIP preflight creates temporary plugin records only. A core summative attempt is created after every challenge answer is finalized, not at upload time.
- Final-submission processing is idempotent, background-job based, append-audited, and replace-on-reprocess for derived functions/questions.
- Student challenge payloads are sanitized; generation prompts, raw output, reference matches, provider keys, and provenance remain private.
- Bank duplication and synchronization must include assignments, requirement sets, and attachment rows while immutable physical files may be shared.
- Production code must not import or execute the research prototype under `tmp/`.
- Plugin authoring uses one guarded draft; independently persisted uploads and processing actions are outside its saved-status claim.
