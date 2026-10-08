# Student View

## Status

Implemented for course/group content and the learner renderers used by MCQ, Parsons, Programming Exercises, Web Design Coding Exercises, and compound Tests. Coding Homework Grader is intentionally inspection-only in Student view until it has an expiring, non-academic upload workspace.

## Product behavior

- In a course's group content perspective, **Student view** opens a separate browser window. Section teachers receive the same action for their assigned group.
- The preview contains the student-visible content projection for that group and never includes the Grades tab.
- The preview and the real learner course page use the same `StudentCourseContent` component for folder tabs/accordions, activity badges, availability locks, icons, and material links. Preview-specific code supplies only alternate activity URLs and omits learner-specific grades/submission badges.
- Group publication and availability, content visibility (including hidden ancestors and group overrides), and activity availability are enforced as learner rules even though the authenticated actor remains a teacher.
- A persistent banner identifies the selected group and states that work is not saved. **Reset preview** clears the browser session state. Safe Exam Browser requirements are explained but do not block preview because no academic record can be created.

## Security and persistence boundary

Student view is a projection, not impersonation. The teacher keeps their own authenticated identity and receives a dedicated `assertCanPreviewGroupAsStudent` authorization check. Course managers/admins may preview any course group; a section teacher may preview only that assigned group. TAs and students do not receive this capability.

Preview answers live under a session-scoped `sessionStorage` key. The dedicated `/student-preview` API namespace resolves content and activities through forced learner visibility rules. Runner-backed actions dispatch only through `ServerActivityPlugin.studentPreview`; handlers registered there must be stateless and may read private tests but may not create attempts, drafts, grades, grade events, analytics events, or plugin execution/submission rows. Normal learner submission endpoints never accept a preview flag.

Programming Exercises execute Judge0 directly without `PluginCodingExerciseExecution`. Web Design Coding Exercises invoke the Playwright runner without plugin submission/test-result rows. MCQ and Parsons evaluation is deterministic and non-persistent. Compound Tests keep parent/item state in the browser and dispatch child actions through the same stateless handlers; starting and finishing a preview Test never creates a core attempt.

## Required activity contract

Every `ActivityDefinition` must declare exactly one `studentView` mode:

- `interactive`, with `execution: "client" | "core" | "plugin"`;
- `read_only`; or
- `unsupported`.

The registries fail closed. An interactive type must have an entry in the dedicated `studentPreviewRenderers` registry; Test-capable types must also have a Test-item renderer. Interactive plugin execution additionally requires exactly one non-empty `ServerActivityPlugin.studentPreview` registration. Read-only and unsupported types cannot register either interactive renderer or plugin preview actions. Registry mismatches abort production startup and are covered directly by SDK tests. Development skips the cross-registry startup assertion because Next.js hot reload can temporarily expose a partially updated module graph; individual preview routes still fail closed when an action has no handler. Server dispatch rebuilds its plugin list from live module bindings for every lookup so a hot-replaced plugin cannot leave preview actions pointing at a stale registration object.

Student view never falls back to the normal activity renderer registry. As defense in depth, the shared browser API client rejects every non-read-only request from a `/student-view` page unless its URL is inside the dedicated `/student-preview` namespace. This turns an accidental call to an ordinary draft, attempt, submission, or plugin mutation route into `STUDENT_PREVIEW_PERSISTENCE_BLOCKED` before the request leaves the browser.

## Deliberate limitation

Coding Homework Grader requires ZIP attachments, background processing, and multi-step durable derived state. Its Student view therefore shows the assignment but disables the submission workflow. A future implementation must use a separately named, expiring preview workspace with no core attempt/grade linkage and guaranteed cleanup; it must not reuse academic submission rows and delete them afterward.

## Regression expectations

- Authorization tests cover course managers, assigned section teachers, and denied actors.
- Core assignment tests prove manager previews still obey learner availability and content visibility.
- Runner tests prove preview execution returns genuine results without calling plugin persistence clients.
- Activity SDK tests ensure only explicitly registered stateless preview handlers can be dispatched.
- Browser coverage should verify new-window navigation, absence of Grades, hidden content, reset behavior, stateless activity interaction, compound Tests, and denied cross-group section-teacher access.
- Browser coverage also verifies that the preview workspace does not refetch during ordinary rerenders, Parsons and Programming Exercise server actions resolve through the preview registry, programming runs stay non-academic, and learner-visible uploaded files download from Student view.
- SDK coverage must reject a missing client adapter, an interactive renderer on a non-interactive definition, a missing or mismatched plugin server adapter, and duplicate server ownership.
