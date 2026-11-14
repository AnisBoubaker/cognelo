# Inspecting work in progress

Student results offers **Inspect work in progress** when the activity supports it and the student is working or has submitted an intermediate stage. It applies from Content and Gradebook in either assessment mode. When no completed submission exists, the empty historical inspection action is replaced by this current-work action. Submitted-attempt review remains available separately when there is history.

The dialog is read-only. It shows server-saved work, an active attempt number when available, and the last saved time in the effective course timezone. **Refresh** retrieves recent saves; unsaved browser edits are not observable. There are no grade, feedback, submit, reset or execution controls. Closing changes no academic data.

## Sources

- Programming Exercises display saved `sourceCode` from the generic draft, without requiring execution or submission.
- MCQ displays saved selections beside question/choice text, without correctness labels, answer keys, scores or automatic feedback.
- Parsons reads the latest private in-progress arrangement without `ensureAttempt`, returning only saved block order/indentation and creating no attempt/event.
- Web Design displays saved HTML/CSS/JavaScript as escaped source, without mounting a preview or contacting the runner.
- Tests use the authorized started parent and retained manifest/revision. The selector loads one saved child at a time through its inspection adapter. Inspection never initializes a Test runtime, updates its manifest, recovers expiry or finalizes work.
- Programming Homework reads existing individual/team preparation or frozen hand-ins and saved question answers. It creates no draft/member, recovers no overdue files, generates no questions and starts no answering clock. File text loads only for the selected file through bounded integrity-checked readers. Current grouping/membership, source and collection revision are revalidated; old preview keys fail after replacement, cancellation or team changes. Private solutions, unrelated assignment attachments, storage paths and provider diagnostics are excluded.

Inspection itself is strictly read-only. Ordinary report progress/action-discovery reads retain their established authorized timeout/hand-in recovery policies independently.

## Contracts and access

Definitions opt in with `supportsWorkInspection`. A type-scoped `ServerActivityPlugin.workInspection` registers `read(context)` and optional `readFile(context)`. Context contains the grader, authorized enrollment/section, activity/assignment, generic saved response and `embedded` flag. Embedded Test reads supply the selected child state; never query an unrelated standalone draft. Return neutral `WorkInspectionSection` blocks: Markdown, plain text, code or file references. Core validates and explicitly projects these fields. Never return raw config, results, grading snapshots, private files, model prompts or correctness evidence. Do not invoke learner routes that initialize work or acquire workflow locks. Unsupported readers fail closed.

`GET /api/courses/:courseId/gradebook/activities/:activityId/work-in-progress` requires `groupId` and `participantId`. Optional `testItemId` must belong to the authorized started parent's manifest. Optional `file` is an opaque current-collection key; the server resolves its actual file. Learners and foreign sections/enrollments are rejected before reading work. There are no mutation methods.

Responses are private/no-store. Snapshots are bounded to 4 MiB, individual text blocks/previews to 2 million characters, file lists to 1,000 entries and Test choices to 300 items. Homework retains its 8 MiB verified file-read ceiling, reports truncated previews and rejects binary previews. Selection changes/unmount abort requests and ignore late results; the selected filename survives refreshed revisions.

## Progress-load failures

Transport failures show **Unavailable**, a visible error/code and **Retry**; later failures retain the last successful badges. They never become Not started or silently clear every badge to a dash. Polling continues to retry. The Coding reader accepts an omitted base projection from older dev route modules and reloads authorized core evidence. A clean local API restart refreshes stale compiled module graphs.

No migration or environment change is required. Local coverage: `work-inspection.spec.ts`, core inspection/scope tests, Coding progress compatibility tests and Homework team/file-only regressions.
