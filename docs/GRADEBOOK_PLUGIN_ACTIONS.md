# Activity-contributed gradebook actions

An activity can offer extra read-only downloads through `ActivityDefinition.gradebookActions`. Each declaration has a stable unique `id`, `kind: "download"`, a `participant` or `activity` scope, and English/French/Chinese/Arabic labels. The gradebook renders supported activity actions in its report header and eligible participant actions in the student's row menu. Other activity types do not inherit these actions. A deactivated provider is blocked before private data is read; disabling creation of new activities does not prevent downloads of existing work.

The owning server plugin registers `gradebookActions` with matching `activityTypeKeys` and two methods:

- `availability(context)` returns eligible participant IDs for each declared action. Eligibility belongs to the activity: a staged activity can expose frozen files before a core attempt or final assessment submission exists.
- `execute(context)` receives the declared action ID, authenticated staff actor, activity, authorized selected enrollments and AbortSignal, and returns a file Response. The activity resolves its private state, validates file ownership and streams its own artifact. Do not regenerate answers, run code, call models or change academic records.

Core authorizes course/section grading scope and derives the current enrolled student roster from assignments. Participants contain enrollment ID, section ID/title, linked user ID and display name; callers cannot supply a user ID, private submission ID or file path. Section staff cannot export another section. Core checks provider eligibility again when executing and rejects provider IDs outside the authorized roster. Complete registry validation requires exactly one service for each action-bearing definition. Core never queries activity-specific tables, interprets their state, or branches on a concrete activity key.

`GET /api/courses/:courseId/gradebook/activities/:activityId/plugin-actions?groupId=...` returns declared metadata with eligible enrollment IDs. `POST` accepts `actionId`, optional `groupId`, and the required `participantId` for participant actions; activity actions take no participant ID. Both endpoints require gradebook permission. Downloads are private/no-store and expose Content-Disposition to the authorized web client.

The shared UI applies the current section filter to batch scope, independent of pagination. A supported action without eligible hand-ins is disabled in the header; participant menu actions appear only for eligible rows. Metadata refresh is lightweight and reads no file bytes. Download preparation uses the shared blocking progress dialog with Cancel; aborts and late results cannot trigger a download. Errors enter shared notifications/history.

## Programming Homework offering

Programming Homework declares **Download submitted files (ZIP)** and **Download all submitted files (ZIP)**. Its service resolves the latest current frozen hand-in per enrollment, including queued generation, waiting activation, answering and ungraded work. Drafts, cancelled/deleted hand-ins and old team bindings are excluded. Downloads do not require challenge answers or a core attempt.

Individual ZIPs retain exact file bytes, relative folders and empty folders. Batch ZIPs contain a uniquely numbered section/student folder per eligible enrollment, with that same submitted collection inside. Current teammates each receive a folder for their own enrollment, even when the underlying code is shared. Private solutions, assignment attachments, provided files absent from the student's upload, questions, answers and grading metadata are never added.

The plugin revalidates current hand-in bindings before and after streaming. Existing bounded, no-follow file readers verify sizes and SHA-256. A collection is limited to 1,000 files/25 MiB, a file to 8 MiB, and a batch to 256 MiB/20,000 files/10,000 explicit folders/30,000 output entries. Folder counts are checked before loading their metadata. Archives stream in bounded chunks; an oversized, missing, changed or corrupt collection fails rather than silently dropping work. No database migration or environment change is required.
