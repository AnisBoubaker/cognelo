# Cognelo Platform Details

Cognelo is a modular intelligent tutoring system (ITS) for programming education. This detailed reference covers platform services, endpoint inventory, setup, seed data, and current frontend behavior.

For a public overview of Cognelo, its educational approach, and the project, visit the [official Cognelo website](https://cognelo.org/).

Plugin-specific behavior, routes, persistence, and UX notes belong in each plugin package under `packages/plugin-activities/*` for activities and `packages/plugin-content-types/*` for non-activity course content.

## Architecture Rationale

- **Next.js + TypeScript** powers both the backend API and frontend app, keeping the MVP cohesive while preserving a clean app boundary.
- **PostgreSQL + Prisma** gives the system relational integrity, migrations, and a schema that can grow into activity versioning, enrollment, sections, TAs, invitations, and research analytics.
- **Shared contracts with Zod** keep API validation close to TypeScript types.
- **Activity and content type registry packages** keep plugin logic out of subject, activity bank, course, and content tree models.
- **Plugin-owned persistence and routes** keep plugin-specific concerns out of core tables and out of hardcoded API files.
- **HttpOnly JWT cookie auth** gives a secure browser default. The eight-hour window rolls forward after each successful current-user check; temporary connectivity or server failures retain the mounted authenticated workspace and retry instead of imitating logout.
- **Built-in i18n** gives the web app English, French, and Chinese UI copy, while plugins can provide their own localized labels.

## Folder Structure

```text
apps/
  api/                 Next.js backend API
  web/                 Next.js frontend
packages/
  activity-sdk/        Plugin registries and shared plugin contracts
  activity-ui/         Shared plugin-facing UI such as code editor/renderer/markdown/notifications
  content-type-sdk/    Content type plugin registry and server contracts
  config/              Environment validation
  contracts/           Shared DTO schemas and types
  core/                Services and authorization
  db/                  Prisma schema, migration, seed, client
  plugin-activities/
    plugin-*/          Activity plugin packages, each with its own README and PROJECT_MEMORY
  plugin-content-types/
    plugin-*/          Course content type plugin packages
docs/
  ARCHITECTURE.md      Durable architecture notes
  PROJECT_MEMORY.md    Platform-level memory for future sessions
  AI_FEEDBACK_GRADING_CHALLENGES_IMPLEMENTATION_PLAN.md
                       Implemented plugin-provided AI feedback, teacher-triggered summative grading, research data, and grade challenges
  STUDENT_MODEL_IMPLEMENTATION_PLAN.md
                       Planned stable skills, learning evidence, mastery projection, and product rollout
```

## Core Modules

- Auth: login, logout, current-user token verification, forced password replacement, and first-login email verification
- Users: `/users/me` plus account-wide profile settings
- Admin user management: list/filter accounts by role, first name, last name, or email; create accounts; edit account names, emails, and multi-role assignments; explicitly confirm an account without an emailed code; and issue forced-change temporary passwords
- AI agent connections: account-wide model/provider connection records, with admin-managed global entries
- Email delivery: admin-managed SMTP relay or Microsoft Graph OAuth configuration, encrypted credentials, an admin-only test message, guarded account-verification messages, and optional grade-challenge response notifications
- Maintenance: an admin-only `/settings/maintenance` workspace with left-side sections; Media currently exposes deduplicated storage metrics, a read-only garbage-collection preview, retention policy, and explicitly confirmed cleanup, while the navigation is ready for a future Upgrade section
- Authorization: global roles plus course memberships and activity-bank ownership
- Subjects: shared curriculum containers with an explicit teaching language, an optional default programming language, subject-level material, activity banks, and subject-scoped knowledge graphs whose concepts own stable skills and misconceptions
- Activity banks: reusable activity authoring libraries scoped to a subject and owned by an individual, with nested drag-and-drop folders and subject-concept filters
- Courses: create, list, read, update, archive; courses belong to a subject and receive activity copies from banks
- Course settings: separate course-level AI agent selections for student support and assessment feedback/grading, with an assessment-feedback master switch
- Memberships: basic course membership creation
- Course content tree: shared placement, ordering, folder nesting, and visibility for folders, legacy materials, plugin-backed content resources, and activities
- Section-specific content visibility overrides preserve the shared course structure while allowing each section to hide or show any inherited folder, activity, or resource independently
- Content resources: plugin-backed non-activity course content such as GitHub repos, uploaded files, and Markdown text
- Materials: legacy generic typed course material records retained for compatibility while new content uses content type plugins
- Activities: typed course-local activity copies with JSON config and research metadata
- Student response drafts: core-owned per-participant/per-assignment JSON state for resumable standalone activity work without consuming a gradebook attempt
- AI assessment feedback: plugin capability/handler contracts, direct teacher-triggered summative evaluation, immediate formative evaluation, plugin-owned teacher review/edit interfaces with whole-class navigation, release-gated student feedback, immutable research events, and mechanism-neutral course-wide challenges for released grades or feedback
- Activity knowledge links: every bank and course activity editor receives a core-owned Concepts tab for linking the activity to whole concepts or exact skills/misconceptions; AI authoring can use selected targets, suggest catalog-constrained links, or ignore knowledge links
- Activity types: enabled type listing plus SDK definitions

## Plugin Boundary

Activity plugins live under `packages/plugin-activities/plugin-*`. Content type plugins live under `packages/plugin-content-types/plugin-*`.

The Coding Homework Grader is registered as `coding-homework-grader` in `packages/plugin-activities/plugin-coding-homework-grader`; its phased design lives in `docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md`. The plugin implements teacher authoring, activity-owned assignment files, prior-documentation snapshot/extraction, C parsing, ZIP preflight and final submission validation, submitted-function candidate analysis, background challenge-question generation, student challenge answers, core gradebook attempts, and teacher manual grading. Its behavior and persistence remain plugin-owned rather than extending core Prisma. Course content extraction and reference similarity are requested through the shared content type plugin server interface; content-specific text/PDF/repository extraction stays inside the owning content type plugins.

The intended boundary is:

- **Core tables stay generic**: `Subject`, `ActivityBank`, `ActivityBankFolder`, `BankActivity`, `ActivityVersion`, `Activity`, `ActivityType`, `CourseContentResource`, `CourseContentItem`, `Course`, and related auth/course tables remain shared.
- **Plugin tables belong to the plugin**: plugin-specific persistence lives in plugin-local Prisma schemas, migrations, clients, and database modules rather than in the core Prisma schema.
- **Plugin HTTP handlers belong to the plugin**: the API app provides a generic dispatcher route, while plugin-specific subroutes are declared in plugin packages.
- **Plugin dispatch authorization is fail-closed**: course activity plugin routes require course-management permission, bank plugin routes require bank-management permission, assigned group routes require authorized group access, and content-plugin mutations require course-management permission. Route definitions must explicitly name their supported activity/content type keys or they are not dispatchable.
- **Content type behavior belongs to content type plugins**: validation, settings forms, plugin routes, storage behavior, open/download behavior, extracted embedding/reference documents, and content-resource extraction/chunking logic live in `packages/plugin-content-types/*`; production vector persistence/search should use shared platform vector services.
- **Bank-to-course copies are explicit**: author against a mutable bank draft, create an immutable version when saving it as Published and its authored content changed, and copy a published version into a course. Course edits mutate only the course copy.
- **Linked course copies synchronize explicitly**: course managers can inspect whether the course copy, latest published bank version, or both changed. Retrieval preserves course placement and assignments, but is blocked after any attempt so attempted course content cannot be replaced. Publishing the course copy remains available after attempts because it does not mutate attempted course content; it creates a new immutable bank version and requires bank write access.
- **Plugin activation and enablement are platform-managed**: installed activity plugins have `ActivityPluginInstallation` records. Newly discovered plugins start inactive and disabled; admins activate them first, then enable them when they should be available. Deactivation disables the plugin and renames plugin-owned tables into versioned backup tables that can be restored during reactivation. Plugin-local migrations provide the activation SQL for creating fresh empty plugin-owned tables when reactivated without restoring a backup.
- **Content type activation mirrors activity plugins**: installed content type plugins have `ContentTypePluginInstallation` records. Enabled content type plugins can create new resources; active but disabled plugins may still serve existing resources; inactive/unavailable plugins render existing rows with an unavailable state.
- **Shared services stay shared**: reusable pieces such as the syntax-colored code editor, code renderer, Markdown renderer, Markdown-backed rich-text editor, portal-based context menu, blocking progress dialog, and shared notification system live in `@cognelo/activity-ui`. Monaco is copied from the pinned npm package into the web app's first-party public assets by the web `predev`/`prebuild` hook, so student editors do not depend on a runtime CDN and continue to load in restricted browsers such as SEB; the shared editor falls back to a controlled plain-text editor if Monaco still cannot initialize. Shared code editors/renderers and Markdown code spans/fences carry `translate="no"` plus the conventional `notranslate` class. Editable code also disables browser autocorrection, capitalization, spelling and writing suggestions, together with known writing-assistant hooks; surrounding instructional prose remains translatable. The document language and direction are set from the saved Cognelo interface locale before the application renders and remain synchronized after locale changes. The shared Markdown renderer sanitizes GitHub-flavored Markdown and renders KaTeX-compatible inline and `$$ ... $$` display math. `RichTextEditor` shows those formulas as protected rendered widgets in Visual mode while retaining their original Markdown source. Visual and Markdown modes share one fixed-height, internally scrolling editing viewport; the bottom handle resizes both modes together, and the control at the far right of the mode bar opens either mode full-screen. Its equation action opens a mouse/touch-friendly MathLive builder with inline/display placement, common structures, and an on-screen math keyboard; clicking a rendered equation reopens the same builder for editing. MathLive is loaded only when that dialog opens. Complete math entered or pasted directly in Visual mode is also preserved and rendered when focus leaves. A table action inserts portable GitHub-flavored Markdown tables from a row/column dialog, and selecting a cell exposes contextual row/column insertion and removal controls. Cell merging is intentionally unavailable because GFM has no portable row-span or column-span representation. Its image action uploads PNG, JPEG, GIF, or WebP files, requires alternative text, supports pixel/original-percentage/container-percentage sizing, and supports later replacement, metadata editing, or removal by clicking the rendered image. Future plugin fields that need visual rich-text editing must reuse the shared editor rather than create competing WYSIWYG implementations.
- **Assessment-feedback responsibility is split deliberately**: core owns the course AI gate/model resolution, teacher trigger, grade/release/audit lifecycle, normalized `AiFeedbackResearchEvent` stream, and `GradeChallenge` workflow. A capable activity plugin owns complete automatic-feedback configuration, immutable rubric snapshots/hashes, prompt/schema versioning, private raw evaluation artifacts, schema validation, sanitized feedback, score composition, and a teacher feedback renderer plus server-side draft/revision validators. The detailed gradebook exposes one **Review and grade** surface for every submitted response and can navigate the whole submitted group; the plugin supplies the answer plus structured feedback/rubric fields and the host supplies the final-grade override. Programming Exercises show the submitted source followed by its hidden-test pass count and per-test outcomes, then treat the unnamed rubric as general grading configuration: teachers configure it independently of automatic feedback in nested **Rubric** and **Test cases** sections of the host **Grading** tab, use it in a manual feedback draft before any model evaluation, and edit criterion scores/narrative in the same form as generated feedback. Their review also shows the live weighted automatic-tests contribution, rubric contribution, and calculated total using the configured proportions; the final-grade field follows that total until the teacher changes it, and an existing teacher-set grade survives later rubric revisions. When a question-authoring agent is available, rubric generation requires a non-empty activity title, student prompt, and reference solution; the server ignores the viewer locale and requests the Subject's teaching language. Generated assessment feedback follows that teaching language too. Empty narrative sections are omitted from learner views. Pre-grade teacher feedback is stored with the attempt and follows it into the later grade. Generated feedback remains pre-populated and its immutable model artifact is preserved. Plugins may return a validated grading result when a teacher changes rubric scores; core then uses the ordinary audited regrade path and records normalized research telemetry. An edited final grade is saved afterward as the teacher's audited override. Summative automatic evaluation is invoked directly by a teacher and never starts from submission or the background-job worker; formative evaluation starts from the learner's explicit check/submit action. Learner-facing copy calls the result feedback/assessment feedback and does not disclose the generating or grading mechanism.
- **Grade-challenge availability follows assignment policy**: each summative course activity starts with challenges disabled in its General settings and can override the value per group. The effective value is materialized on the group assignment and is enforced by the student-facing report and again by core when a challenge is created. Turning the setting off prevents new challenges but preserves existing records for learner visibility and staff resolution. Formative assignments cannot enable challenges.
- **Rich-text media is reference-managed**: image uploads create logical media assets backed by SHA-256 content-addressed local blobs. Identical bytes are stored once, while subjects, mutable bank activities, immutable versions, course copies, and immutable Test snapshots retain independent database references. Staged uploads expire, unreferenced active assets receive a recovery grace period, and an explicit garbage-collection command moves bytes through delayed trash removal. See [Rich-text media assets](../MEDIA_ASSETS.md).
- **Remote execution stays outside the API app**: activities that run learner code should call an external sandbox service such as Judge0 from server-side plugin routes.

Plugin packages can export:

- activity definitions
- default picker metadata such as category membership and a semantic icon name rendered through the app-wide Tabler icon system
- localized metadata and UI strings
- database manifests
- plugin-local Prisma schemas, migrations, and generated clients
- persistence/services
- server route definitions
- web components
- plugin-local `README.md` and `PROJECT_MEMORY.md`

Content type plugin packages can export:

- content type definitions for picker metadata and localized labels
- settings/rendering components registered by renderer key
- server create/update/delete/open-action handlers
- plugin routes for upload/download/viewer behavior
- `getEmbeddingDocuments` handlers that return extracted text/reference documents and diagnostics for future indexing
- vector indexing/search handlers that submit/search plugin-owned content documents through the shared vector service behind the unified content type interface
- database manifests and plugin-owned migrations when generic resource metadata is not enough

For the beginner-friendly plugin authoring handbook, including step-by-step setup, shared services, persistence patterns, and research/grading guidance, see the [plugin authoring handbook](../plugin-authoring/README.md).

## API Surface

Student view uses `/api/courses/:courseId/groups/:groupId/student-preview` for the forced learner workspace, nested activity reads, stateless activity actions, and compound-Test child actions. These routes authorize the real teacher, then enforce learner visibility and dispatch only the plugin SDK's stateless preview contract; they do not reuse academic draft, attempt, or submission routes. Each activity definition must explicitly declare `interactive`, `read_only`, or `unsupported`. Startup validation requires matching dedicated client/Test-item renderers and exactly one plugin server adapter where applicable; the browser API also rejects ordinary mutations while running under `/student-view`.

Core endpoints:

```text
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/email-verification/send
POST   /api/auth/email-verification/verify
GET    /api/health
GET    /api/users/me                         # verify and renew the browser session
PATCH  /api/users/me
PUT    /api/users/me/password
GET    /api/users
POST   /api/users
PATCH  /api/users/:userId
PUT    /api/users/:userId/email-verification
PUT    /api/users/:userId/password
GET    /api/ai-agents
POST   /api/ai-agents
PATCH  /api/ai-agents/:connectionId
DELETE /api/ai-agents/:connectionId
GET    /api/subjects
POST   /api/subjects
GET    /api/programming-languages
GET    /api/subjects/:subjectId
PATCH  /api/subjects/:subjectId
POST   /api/subjects/:subjectId/concepts
PATCH  /api/subjects/:subjectId/concepts/:conceptId
GET    /api/subjects/:subjectId/concepts/:conceptId
DELETE /api/subjects/:subjectId/concepts/:conceptId
GET    /api/subjects/:subjectId/concepts/:conceptId/skills/:skillId
DELETE /api/subjects/:subjectId/concepts/:conceptId/skills/:skillId
GET    /api/subjects/:subjectId/concepts/:conceptId/misconceptions/:misconceptionId
DELETE /api/subjects/:subjectId/concepts/:conceptId/misconceptions/:misconceptionId
POST   /api/subjects/:subjectId/prerequisites
DELETE /api/subjects/:subjectId/prerequisites/:prerequisiteId
POST   /api/subjects/:subjectId/knowledge-graph/generate
GET    /api/settings/email
PUT    /api/settings/email
POST   /api/settings/email/test
GET    /api/activity-banks
POST   /api/activity-banks
GET    /api/activity-banks/:activityBankId
PATCH  /api/activity-banks/:activityBankId
DELETE /api/activity-banks/:activityBankId
GET    /api/activity-banks/:activityBankId/activities
POST   /api/activity-banks/:activityBankId/activities
GET    /api/activity-banks/:activityBankId/activities/:bankActivityId/versions/diff
PATCH  /api/activity-banks/:activityBankId/activities/:bankActivityId
DELETE /api/activity-banks/:activityBankId/activities/:bankActivityId
POST   /api/activity-banks/:activityBankId/activities/:bankActivityId/duplicate
POST   /api/activity-banks/:activityBankId/activities/:bankActivityId/move
GET    /api/courses
POST   /api/courses
GET    /api/courses/:courseId
PATCH  /api/courses/:courseId
DELETE /api/courses/:courseId
PATCH  /api/courses/:courseId/settings
POST   /api/courses/:courseId/memberships
GET    /api/courses/:courseId/groups
POST   /api/courses/:courseId/groups
GET    /api/courses/:courseId/groups/:groupId
PATCH  /api/courses/:courseId/groups/:groupId
DELETE /api/courses/:courseId/groups/:groupId
GET    /api/courses/:courseId/groups/:groupId/participants
POST   /api/courses/:courseId/groups/:groupId/participants
GET    /api/courses/:courseId/groups/:groupId/activities
POST   /api/courses/:courseId/groups/:groupId/activities
GET    /api/courses/:courseId/groups/:groupId/content
POST   /api/courses/:courseId/groups/:groupId/content/folders
POST   /api/courses/:courseId/groups/:groupId/content/materials
POST   /api/courses/:courseId/groups/:groupId/content/activities
PATCH  /api/courses/:courseId/groups/:groupId/content/:contentItemId
DELETE /api/courses/:courseId/groups/:groupId/content/:contentItemId
GET    /api/courses/:courseId/groups/:groupId/grades
GET    /api/courses/:courseId/materials
POST   /api/courses/:courseId/materials
POST   /api/courses/:courseId/materials/upload
PATCH  /api/courses/:courseId/materials/:materialId
DELETE /api/courses/:courseId/materials/:materialId
GET    /api/courses/:courseId/materials/:materialId/download
GET    /api/courses/:courseId/content
POST   /api/courses/:courseId/content/folders
POST   /api/courses/:courseId/content/materials
POST   /api/courses/:courseId/content/activities
PATCH  /api/courses/:courseId/content/:contentItemId
DELETE /api/courses/:courseId/content/:contentItemId
GET    /api/courses/:courseId/content-types
GET    /api/courses/:courseId/content-resources
POST   /api/courses/:courseId/content-resources
PATCH  /api/courses/:courseId/content-resources/:resourceId
DELETE /api/courses/:courseId/content-resources/:resourceId
GET    /api/activity-types
GET    /api/plugins
PATCH  /api/plugins/:pluginKey
GET    /api/content-type-plugins
PATCH  /api/content-type-plugins/:pluginKey
GET    /api/courses/:courseId/activities
POST   /api/courses/:courseId/activities
GET    /api/courses/:courseId/activities/:activityId
PATCH  /api/courses/:courseId/activities/:activityId
DELETE /api/courses/:courseId/activities/:activityId
POST   /api/courses/:courseId/activities/:activityId/duplicate
GET    /api/courses/:courseId/activities/:activityId/bank-sync
POST   /api/courses/:courseId/activities/:activityId/bank-sync
GET    /api/courses/:courseId/activities/:activityId/assign-all-groups
POST   /api/courses/:courseId/activities/:activityId/assign-all-groups
DELETE /api/courses/:courseId/activities/:activityId/assign-all-groups
GET    /api/courses/:courseId/gradebook
PATCH  /api/courses/:courseId/gradebook/items/:gradebookItemId/release
```

Plugin-specific subroutes are dispatched through:

```text
/api/courses/:courseId/activities/:activityId/[...pluginPath]
/api/activity-banks/:activityBankId/activities/:bankActivityId/[...pluginPath]
/api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/[...pluginPath]
/api/courses/:courseId/content-resources/:resourceId/[...pluginPath]
/api/courses/:courseId/groups/:groupId/content-resources/:resourceId/[...pluginPath]
```

Standalone student activity drafts use the generic assigned-activity route:

```text
GET    /api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/draft
PUT    /api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/draft
DELETE /api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/draft
```

These drafts are separate from gradebook attempts. Compound Test children continue to autosave through their parent Test runtime and `TestItemAttempt` records rather than this standalone route. The Test shell keys each embedded renderer by Test item so navigation cannot carry local editor state from one child into another.

Concrete plugin routes are documented in the owning plugin package.

The web app keeps plugin-specific React wiring in registries: activity renderers in `apps/web/src/lib/activity-renderers.tsx`, and content type settings/rendering in `apps/web/src/lib/content-type-renderers.tsx`. Route components should consume registered definitions and renderer entries instead of importing plugin packages or branching on concrete plugin keys.

## Authorization Model

- **Admin** can manage all platform resources.
- **Course manager** can create subjects and courses.
- **Teacher** can create activity banks, own/manage their banks, and manage courses where they are owner, teacher, or TA.
- **Student** can view course sections where they are registered.
- Course roles are separate from global roles, leaving room for TAs, assistants, section leaders, and future custom roles.

Course authorization distinguishes explicit course roles from section-derived discoverability. Explicit owners and course teachers manage the course; explicit course teachers and global-teacher owners grade course-wide, while a pure course-designer owner does not grade. Section teachers and TAs see effective content and may inspect, grade, export, and answer challenges only for assigned sections. Section teachers may manage their assigned roster; TAs may not. Neither section role may change course structure/settings/staff, persist activity-wide AI grading instructions, or release/hide grades. Explicit course-level TA assignment is rejected.

`CourseMembership.source` is `explicit` or `section_derived`. Adding section staff creates only a derived row for course-list discoverability, never broad authority. Removing one assignment preserves other section access; removing the last matching assignment removes the derived row. Explicit staff is managed in the course Participants workspace, duplicate assignment is idempotent, revocation applies on the next request, and the final explicit owner cannot be removed. Staff removal never deletes attempts, grades, feedback, challenges, or actor history. `CourseAuditEvent` records course staff, roster, course, and AI-settings mutations with the real actor. Grade/feedback review uses optimistic timestamps/hashes and returns `GRADE_EDIT_CONFLICT` or `FEEDBACK_EDIT_CONFLICT` when a stale dialog tries to save. The capability matrix and executable scenario catalog live in [Role Authorization And Multi-Teacher E2E Plan](../ROLE_AUTHORIZATION_E2E_IMPLEMENTATION_PLAN.md).

## Database Design

Core Prisma entities include:

- `User`
- `AiAgentConnection`
- `Role`
- `UserRole`
- `Subject`
- `SubjectKnowledgeConcept`
- `SubjectKnowledgePrerequisite`
- `SubjectMaterial`
- `ActivityBank`
- `ActivityBankFolder`
- `BankActivity`
- `ActivityVersion`
- `Course`
- `CourseMembership`
- `CourseMaterial`
- `CourseContentResource`
- `CourseContentItem`
- `ActivityType`
- `ActivityPluginInstallation`
- `ActivityPluginTableBackup`
- `ContentTypePluginInstallation`
- `ContentTypePluginTableBackup`
- `Activity`
- `ActivityResponseDraft`
- `CourseGroupActivity`
- `GradebookItem`
- `ActivityAttempt`
- `Grade`
- `GradeEvent`

Enums cover course status, course membership role, course section participant role, material kind, activity lifecycle, attempt lifecycle, grade source, grade event type, grading mode, attempt limit mode, and grade strategy.

## Content Model

The current content model is:

```text
Subject
  subject-level material
  knowledge graph
    concept(s)
      directed prerequisite edge(s)
  ActivityBank(s)
    ActivityBankFolder(s)
    BankActivity
      BankActivityKnowledgeConcept
      ActivityVersion(s)
  Course(s)
    course-specific material
    Activity copy copied from one ActivityVersion
    Section(s)
      participants
      activity availability/assignment rows
        GradebookItem
          ActivityAttempt(s)
          Grade
          GradeEvent(s)
```

Activity banks are reusable authoring libraries. A bank activity keeps a mutable current record plus immutable `ActivityVersion` snapshots. Publishing changed authored content creates a new version for future course use; ordinary draft saves do not.

Tests are reusable bank activities too. A bank Test owns hidden independent child bank activities that can be created specifically for the Test or copied from any published activity under the same subject. The source is never referenced live: deleting it does not affect the Test. Publishing freezes Test settings, order, points, required flags, and exact child generic versions in a normalized composition snapshot. Removing an item archives its owned child so earlier published Test versions remain complete, while deleting the whole Test cleans up every owned child. Adding the Test to a course deep-copies its shell and every child, including plugin-private data through the ordinary bank-to-course hooks. A course-local Test can also be added to a writable same-subject bank; child course-to-bank hooks complete before the course graph is linked to the new published bank versions. Compound bank synchronization is the next phase, so the generic shell-only synchronization action is currently hidden and rejected for Tests.

Each bank has its own nested folder tree. Folders and activities share sibling ordering in the authoring UI, and owner/admin drag operations update only `parentId`/`folderId` plus position; they do not mutate authored activity content or version history. Deleting a folder removes that folder subtree while moving every contained activity safely to the bank root. The bank filter dialog lists the active concepts from the bank subject with distinct linked-activity counts. Applied concept selections use inclusive OR semantics, retain matching ancestor folders, and run entirely against normalized `BankActivityKnowledgeConcept` links; clearing the selection restores the full tree.

The activity-bank list exposes creation plus owner/admin edit and delete actions while preserving row navigation into each bank. Title and description are editable; subject is editable only while the bank is empty. Deleting a populated bank either moves its activities, in order, to another writable bank under the same subject or requires a second confirmation to delete all bank contents. Existing course-local activity copies survive destructive bank deletion with their bank/version traceability links cleared.

Bank activity row actions can publish any draft, paused, or archived activity directly from the list using the existing lifecycle update, without changing its authored fields. They can also duplicate an activity as a new independent unpublished draft, including plugin-owned private authoring data, or move the existing activity and its complete history to another writable bank under the same subject. The duplicate dialog defaults the editable title to the source title plus ` (copy)` and increments an existing terminal suffix as ` (copy #2)`, ` (copy #3)`, and so on. Duplication and movement append the resulting activity at the end of its bank. A duplicate starts version history only when it is first published.

Each bank activity row with at least two versions exposes **Compare versions** in its actions menu, opening a shared diff visualizer without crowding the activity editor. Core provides semantic comparisons for title, description, lifecycle, activity type, and concept/skill/misconception selections, plus recursive structured diffs for generic activity config and metadata. Multiline changes preserve line breaks, show only nearby contextual hunks, highlight exact changed characters, and expand Markdown `##` question changes to the containing question. Unchanged fields are omitted. Plugin-private authoring rows are not included because they are not currently snapshotted per `ActivityVersion`.

Course content activity actions can similarly duplicate an activity with an editable, sequence-aware copy title. The copy is an unassigned draft placed in the same content folder with the same local visibility, retains the source `bankActivityId` and `activityVersionId` traceability when present, copies knowledge selections and plugin-owned private course authoring data, and deliberately omits the source assignment-settings policy. Compound Tests use their dedicated deep-copy service so their child activities are duplicated too.

The same course Content action also duplicates GitHub, file, and text resources plus compatibility legacy materials into the original folder with the original visibility. Content type plugins own their duplication semantics; uploaded file copies share the immutable stored file reference, while derived embedding indexes are discarded so a copy can be indexed under its new resource identity.

Knowledge-concept selection is a mandatory platform capability rather than an activity-plugin option. The host application wraps every activity authoring surface in an Activity/Concepts tab set. The Concepts tab orders prerequisite foundations first, then uses prerequisite count and localized title as deterministic tie-breakers. Its two-column selector shows concepts on the left and the active concept's skills and misconceptions on the right. Teachers can select a whole concept or exact skill/misconception lines; whole-concept selection is deliberately distinct from selecting every current target individually. Links are normalized core data: bank selections are snapshotted onto each `ActivityVersion`, copied when that version becomes a course activity, and then edited independently on the course copy. Teachers may leave the selection empty, but plugins cannot remove the Concepts tab.

Adding a bank activity to a course creates a course-local `Activity` copy from the selected version at the folder and visibility chosen in the picker. Because published bank content is assumed ready for use, the picker closes and leaves the teacher in the course content view instead of opening the copied activity editor. Locally created activities still open for authoring. The copy keeps `bankActivityId` and `activityVersionId` for traceability, but it is not a live reference. Editing the course copy affects only that course and its students. Editing the bank later creates a new version and does not alter existing course copies.

Course activity assignment is managed from a wide settings dialog with left-side General, Group assignment, AI settings, and Exceptions tabs; AI settings and Exceptions are placeholders. General stores inherited availability, visibility, assessment mode, Safe Exam Browser requirement, and the summative gradebook policy. Folder placement is deliberately absent because the course content tree's drag-and-drop interaction is the only folder-management surface. Assessment mode is never group-overridable, and formative groups do not expose summative-only overrides. Group assignment has one tab per current group, an **Assign to all** action that only checks every current group's Assigned box, and explicit per-setting override checkboxes. An unchecked override tracks General; checking it initializes the revealed group control from the current General value. Unchecking Assigned removes that group's `CourseGroupActivity` and its overrides when settings are saved. General visibility updates the canonical course content item, while a group visibility override uses the same `CourseGroupContentVisibilityOverride` read by learner content and direct-access enforcement. The save is transactional across the activity policy and all affected group assignment, visibility, and gradebook rows.

Real `CourseGroupActivity` rows are the authoritative assignment state shown in the dialog. An activity with no assignment rows shows every current group unchecked, so opening and saving settings cannot silently assign it. Groups created later also start unassigned, including when every earlier group was assigned. Every assignment has a matching group-scoped activity `CourseContentItem`, even when the caller omits `contentPlacement`: core creates a visible root placement and later moves/updates it when a destination was supplied. A database insertion trigger provides the same safe default for low-level writers, while deferred assignment/content triggers reject a transaction that would leave a surviving assignment without a valid matching placement. Migration `202610070003_assignment_content_integrity` repairs historical assignments by inheriting the matching shared activity's folder, position, and visibility where possible, otherwise placing them visibly at the group root. The development seed preserves assignment placements while rebuilding seed-owned folders, so it obeys the same invariant. Every inspectable formative check and summative submission creates a core `ActivityAttempt` tagged with the assignment mode at that moment. Formative attempts remain ungraded and do not consume summative limits or enter summative results, while summative attempts can create grades under the configured points, pass/fail, attempt-limit, and grade-selection policy.

Changing a formative assignment to summative preserves the existing formative attempts for teacher inspection but excludes them from later summative grading. Changing a summative assignment to formative is destructive gradebook state conversion and therefore requires an explicit confirmation in both the settings UI and API request: existing summative attempts become formative, active grades are withdrawn, released grades are hidden, and per-student audit events retain the transition and grade snapshot.

Summative assignments can additionally require Safe Exam Browser (SEB). A student opening a protected assignment in an ordinary browser receives a confirm/cancel launcher instead of activity content. Confirming synchronously closes that launcher before the browser receives the `seb://` or `sebs://` URL, so the ordinary tab cannot offer the same short-lived configuration again after the learner returns from SEB. The ordinary course overview does not probe protected activity-scoped routes, so adding an SEB assignment does not gate the course page or surface an expected access denial there. Cognelo creates a short-lived, user- and assignment-scoped launch URL, serves a generated `.seb` property-list configuration, and supports both direct protocol launch and configuration download. The SEB start URL returns to the selected activity; if the SEB browser has no Cognelo session, login preserves that return URL. Cognelo validates the generated Config Key through SEB's URL-bound request header or JavaScript API, then issues an HttpOnly SEB access session scoped to that user and assignment. The assigned activity detail, generic plugin dispatcher, response drafts, submission history, embedded media, compound Test runtime/item/action routes, and final submission all enforce that session. Managers bypass the learner gate for preview and administration. Student course/group DTOs omit authored activity config, protected group DTOs also omit the prompt and provenance snapshots, and full course-activity/group-assignment authoring services are manager-only, so the launcher cannot be bypassed through a parallel content endpoint.

The course Participants tab renders every group and its participant list inline. Teachers create and edit groups and add participants through modal dialogs, while group deletion retains the protected-last-group and transfer/permanent-deletion safeguards. Each group also accepts a browser-validated student CSV with no header. The normal fixed format has three required columns in the order `first name,last name,email`, plus an optional fourth `external ID`. When **CSV includes assigned passwords** is selected, the fixed format instead has four required columns in the order `first name,last name,email,password`, plus an optional fifth `external ID`; passwords must contain at least eight characters. Every email is validated, existing group emails are skipped, and all imported participants have the `student` role. Assigned-password imports create active, immediately linked accounts with the supplied password, `mustChangePassword = false`, and email already marked verified, so Cognelo sends no verification message and the student can sign in immediately. An existing active, verified account is linked only when the supplied password matches; its password is never overwritten. Students with no remaining group enrollment are removed from the course student membership.

Each `CourseGroupActivity` assignment has one corresponding `GradebookItem`, created when the assignment is materialized directly or through the course activity settings dialog. A newly created group receives no existing activity assignments automatically.

`CourseContentItem` provides the canonical course content tree: shared placement, ordering, nesting, and visibility for folders, materials, and activities without merging their domain behavior. Folders are generic course content structure, live at the course level, and are preserved across groups; group-specific materials and activities can be placed inside those shared folders. Materials remain non-assigned resources, while activities remain generic course or group assignment records with plugin-owned behavior isolated in plugin packages. Core course/group content APIs can create folders, place materials, place activities, move/update items, delete items, and list all or effectively visible content items. Activity creation and assignment contracts can optionally carry `contentPlacement` so activity rows and group assignments can create matching content-tree activity items. Deleting a folder preflights its complete descendant subtree and treats contained activities as one deletion batch. If any activity has a core attempt record—including retained soft-deleted attempt history—the API rejects the whole operation without running plugin cleanup and reports every protected activity and its attempt count. Otherwise, plugin deletion hooks run for each activity (and each private child of a compound Test) before the activities and folder subtree are removed. A shared activity placement is the structural authority; a stale assignment-backed duplicate found below a folder whose shared placement is elsewhere is moved beside the deleted folder instead of deleting the activity. Direct deletion of only an activity placement is rejected so the gradebook cannot retain an activity that students can no longer reach.

Individual activity deletion remains possible even when attempts exist, but it is intentionally a different destructive workflow. The teacher first sees an activity-specific warning that submissions, grades, and attempt history will be permanently removed; only after accepting it does the normal delete confirmation appear. The API requires the corresponding explicit confirmation flag before any plugin deletion hook runs, so callers cannot bypass the warning by issuing the ordinary activity DELETE request directly.

Visibility is content-tree state and is separate from activity availability. A visible upcoming activity is shown but locked; a visible expired activity remains reviewable but cannot start another attempt; and a hidden item or descendant of a hidden folder is omitted from student content. The same effective-visibility rule is enforced when a non-manager requests an assigned activity or one of its plugin routes directly; hiding is an access boundary, not only a rendering choice. The learner overview skips protected submission-history probes for Safe Exam Browser and upcoming assignments, so an expected activity-scoped denial never aborts the rest of the content or Grades view. Student group workspaces render a single Content tab with first-level folders as accordions. Teachers manage structure and ordering in Course mode, then use the compact Course/Group perspective selector to inspect one group's effective content and override visibility. Group perspective is visibility-only and exposes no move or remove affordances. When a selected group assignment also has an inherited course placement, the listing keeps the inherited placement as the row's structural and visibility identity while merging the group assignment ID needed to open the assigned activity.

Course content resources are now plugin-backed through content type plugins. The current content type plugins are GitHub repo, File, and Text under `packages/plugin-content-types/*`. The course picker reads enabled content type definitions, while existing content rows can still render through active disabled plugins. Folders remain generic core content tree items rather than plugins.

Each content type plugin can expose `getEmbeddingDocuments`, `indexEmbeddingDocuments`, and `searchEmbeddingDocuments` handlers. Core exposes generic dispatchers so indexing or activity-generation code can ask for extracted documents and vector similarity without importing concrete content plugins. Content-specific extraction/chunking stays in the owning content type plugin. The current development implementation uses deterministic embeddings and plugin-owned resource metadata; production should use common platform pgvector tables behind the same handler contract so activity plugins can search all relevant course content across content types.

Core gradebook services create numbered, mode-tagged `ActivityAttempt` records for assigned group activities, enforce summative attempt limits, compute lateness at submission time, normalize raw plugin scores to the gradebook item scale, apply pass/fail thresholds and late penalties, select the current grade across summative attempts, and record grading results with `GradeEvent` audit entries. Plugins keep their private attempt/submission artifacts in plugin tables and call the core services to keep gradebook records consistent. The teacher detail view exposes formative attempts through the same plugin-aware inspector in read-only mode.

Teachers view gradebook results from the course Gradebook tab. Its overview calls the gradebook API with `view=summary`, which returns only course, activity, and group aggregates and omits learner identities and attempt histories. Gradebook activity rows and selectors preserve the canonical depth-first course-content order, including folder nesting, instead of sorting titles alphabetically. A course-scoped activity placement is authoritative when assignment-backed group placements also exist; an activity with only group placements uses its earliest relevant placement, and an activity with no content placement remains available after placed activities under a deterministic title/ID fallback. Detailed result surfaces use the full response with one row per student participant and assigned group activity, including missing work. Both forms support group, activity, and status filters, while the legacy whole-gradebook CSV retains its dedicated format. Per-activity grade export is available from an activity's course-content context menu, the gradebook overview at activity or group scope, and the activity detailed-results page. Its shared dialog offers CSV or XLSX and an editable filename initialized to `CourseTitle-GroupName-ActivityTitle-YYYY-MM-DD-HHmmss` when the dialog opens. The four exported columns are `email`, `first name`, `last name`, and numeric `grade`; only rows whose normalized grade is plugin-confirmed complete are included, so partial multi-component grades, ungraded submissions, formative work, and non-submissions are omitted. The course workspace requests the summary only when the Gradebook tab is active; Content has its own request lifecycle and explicit loading state.

Teachers can release or hide final grades per gradebook item from the course gradebook, including its expandable group summaries. Release/hide changes are audited with participant-scoped `GradeEvent` rows. Before release, a repeatable summative activity—unlimited, until-due, or a maximum greater than one—shows the student their latest provisional attempt result and plugin-supported attempt review so feedback can guide another attempt. Releasing publishes the final grade selected by the configured latest/best/first/weighted strategy and prevents further attempts. A single-attempt summative grade remains hidden until release. Student responses remain normalized and do not expose raw plugin grading payloads or hidden Test details.

The course gradebook defaults to an activity summary table. Each row shows submission count, graded count, mean grade, release/hide for all assigned groups, and a detailed-results link; expanding a row shows group-level summaries and group-specific release/hide controls. The detailed activity results page lists per-student results and can be scoped to one group from the course gradebook. While **Student results** is visible, it polls a lightweight authorized feed every ten seconds and marks each current-mode attempt in progress with its attempt number and localized start time; the full gradebook response is not polled. It uses consistent capability-driven actions across activity types: **Class overview** for aggregate reporting, **Rerun automatic grading** only when current-answer regrading is supported, **Assess with AI** with a confirmation that states whether grades change, and **Review and grade** for the submitted answer, feedback/rubric, and final score. For direct AI-grading plugins, whole-activity assessment first opens a shared guided-batch dialog with current activity instructions, an optional default-on settings update, and up to three plugin-validated complete graded examples; selected examples are excluded from reassessment and learner identity is never included in the model context. Compound Tests continue to delegate configuration to their children. The aggregate report covers standalone and compound activities: MCQ choice analysis, Parsons solution/error/grade distributions, coding and web-design solutions plus one pass/fail summary for every individual grading test, and a global-solution fallback for other activity types. Unsupported actions are omitted instead of shown as unavailable.

Teachers can manually override a student's current grade from the detailed activity results page. Overrides replace the current grade, clear the selected attempt link, and write an `overridden` grade event with previous/next grade snapshots and the teacher reason. Teachers can also trigger an automatic regrade for the selected/latest submitted attempt when the plugin exposes a server grading handler; the platform records completed grading as a `regraded` grade event. Parsons evaluates its stored state against current configuration. Programming Exercises rerun current hidden tests without invoking AI, save a separate test evaluation, and combine the new deterministic score with the latest rubric score under current component weights; if no rubric score exists, the test result is saved but final grading is deferred. The separate teacher-triggered feedback action assesses the current rubric against the latest saved tests without rerunning them.

Activity plugins can declare grading capabilities, manual grading renderer hints, and core-compatible grading results. Parsons is the first plugin wired into this contract; it advertises attempt, automatic grading, manual grading, and analytics support. Formative Parsons checks create ungraded formative core-attempt snapshots for inspection, while summative Parsons submissions create summative core attempts and automatic grades from the Parsons evaluation.

Plugins that store private authoring/grading data can participate in the copy step through server plugin hooks. For example, web-design coding exercises copy the private reference bundle and Playwright tests from bank plugin tables into course plugin tables when the course activity is created.

Plugin-owned tables are documented in the owning plugin package rather than in the platform README.

## Seed Accounts

All seeded accounts use `Password123!`.

The application does not prefill the sign-in form. Browsers and password managers may offer saved credentials through the standard username and password autocomplete fields.
The login submit control uses an explicit non-native appearance so Safari autofill cannot repaint its gradient away while retaining white text.
The authenticated account menu shows the running web build as `Cognelo ver. …` beneath Logout. Builds derive this value from the nearest `cognelo-*` Git tag and include commit/dirtiness metadata when the checkout is not exactly tagged. `NEXT_PUBLIC_COGNELO_VERSION` can override the value at build time, and source archives without Git metadata fall back to the web package version. Production builds must set that override to the immutable release version because Prisma generation can legitimately change tracked generated clients inside an otherwise exact tagged deployment worktree before the web build runs.

```text
admin@cognelo.local
teacher@cognelo.local
student@cognelo.local
```

The seed also creates a sample subject, an activity bank with coding/web-design/Parsons/Coding Homework Grader examples, a sample course, starter materials, two sections, assigned activities, and a mixed course content tree for development. The seeded content tree includes visible and hidden folders with materials and activities placed side by side.

Programming 101 includes a reproducible AI-feedback review dataset. A clean seed places Sam Student plus 20 accounts (`programming.a01@cognelo.local` through `programming.a20@cognelo.local`) in Section A and 15 separate accounts (`programming.b01@cognelo.local` through `programming.b15@cognelo.local`) in Section B. It publishes `C exercise: Median of three integers` in the Programming basics bank, adds it to the course, assigns it summatively to every section, and enables the course assessment-feedback setting with the seed model. Rerunning the seed preserves any course feedback model and enable/disable choice already selected by a teacher instead of restoring the fallback connection. Every linked student in Sections A and B receives one submitted attempt awaiting teacher-triggered feedback/grading. On a clean database the 36 submissions contain six correct solutions, three compilation errors, and varied logic/output-contract mistakes; the fixture does not fabricate feedback, evaluations, or final grades. The additional accounts use the same seeded password shown above.

The Coding Homework Grader seed fixture creates `Coding homework grader: INF-155 TP1 Labyrinthe` in Programming 101 / Section A, with the extracted `tmp/INF155-A2023-TP1.pdf` assignment text, a copied assignment PDF attachment when the local file exists, ZIP structure requirements based on `tmp/FichiersFournis`, a ready prior-documentation snapshot, a summative group assignment, and a gradebook item. It also creates `seed-ai-agent-student-support` for the separate course student-support AI setting. Challenge question generation tries explicit course staff question-authoring preferences in creator, owner, then teacher order and skips unusable connections; the seed preserves existing teacher preferences and does not silently route challenge generation to local Ollama unless an explicit staff preference selects it.

## Run Locally

1. Copy environment values:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d db
```

If you are developing the coding-exercises plugin, also start Judge0 locally:

```bash
docker compose up -d judge0-db judge0-redis judge0-server judge0-worker
```

Local Compose defaults to `ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2`, the Cognelo-tested Apple Silicon development image. Docker Desktop uses Judge0's per-process/thread limit fallback because it does not delegate a usable cgroup-v2 subtree; this is for trusted local development and is not equivalent to production cgroup isolation. The development worker pool is capped at two because Docker Desktop reports the host CPU count and a large automatically sized pool can collide over isolate boxes. Compose also mounts `infra/judge0/isolate.dev.conf` into both Judge0 containers so Isolate 2.x continues to accept Judge0's increasing submission IDs beyond its default 1,000-box range. Before workers accept jobs, an idempotent one-shot service configures every active C and C++ runtime with the common course-level system libraries for math, POSIX threads, dynamic loading, and POSIX realtime (`-pthread -lm -ldl -lrt`). Its C, C++, Go, Java, JavaScript, Python, Rust, and TypeScript runtimes have been validated with real compile/execute and stdin/stdout submissions. Set `JUDGE0_IMAGE` to override the image. The Ubuntu production runbook continues to use the official pinned Judge0 image on its supported Linux sandbox host. Cognelo treats every Judge0 internal error as a retryable service failure rather than a learner test result, and stops AI test correction immediately when every reference run fails at compilation or with a Judge0 internal error, because changing generated tests cannot repair the execution environment.

If you are developing the web-design-coding-exercises plugin, also start the Dockerized Playwright runner:

```bash
npm run dev:runner
```

3. Install dependencies:

```bash
npm install
```

4. Run core and plugin migrations, then generate Prisma clients:

```bash
npm run db:migrate:all
```

The root `npm run db:migrate` command aliases this same combined migration
path. Do not run raw `prisma migrate dev` against the shared database. The core
Prisma schema intentionally excludes plugin-owned tables, so the raw Prisma
command sees valid plugin tables as drift and can offer a destructive reset.

After generating a Prisma client while development services are already running, restart those services with `npm run dev:stop` followed by `npm run dev`. Node may otherwise retain the previously generated client module even when application code hot-reloads. The shared development client also fingerprints the loaded Prisma schema so a hot reload does not reuse a schema-stale global singleton, but restarting is the guaranteed way to load regenerated client code.

5. Seed sample data:

```bash
npm run db:seed
```

The development seed registers Judge0 at `http://localhost:2358` with the local Compose token and the Web Design runner at `http://localhost:3456`. SageMath is shown under **Settings → Runners** but remains unconfigured until a compatible service is available. Administrators can replace or disable any endpoint there.

6. Run automated checks:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

ESLint uses the repository-level flat configuration with Next.js Core Web Vitals and TypeScript rules; generated clients and build outputs are excluded. React Compiler rules that would require broad runtime-sensitive refactors are temporarily disabled so restoring lint remains a tooling-only migration. Vitest covers contracts, core service behavior, API route orchestration, and plugin lifecycle contracts. Playwright covers authentication; global and course-scoped roles; administration; course, group, participant, and bank management; authoring and learner completion for every installed activity type; compound Tests; attempt policies; automatic grading; grade release; and learner grade visibility. The E2E suite requires a migrated and seeded development database, starts missing web/API development servers automatically, uses disposable uniquely named records, and cleans up only the exact records it creates. Real coding, web-design, and Coding Homework flows additionally require their documented execution or AI services. See [Browser user flows](../../tests/e2e/README.md) for the flow inventory, prerequisites, environment overrides, and browser installation options.

7. Start both apps:

```bash
npm run dev
```

Open:

```text
Web: http://localhost:3000
API: http://localhost:3001
Judge0 (dev): http://localhost:2358
Web design runner (dev): http://localhost:3456
```

## Production Deployment

The initial production runbook is [Deploying Cognelo on Ubuntu with Apache](../DEPLOYMENT_UBUNTU_APACHE.md). Its production reference uses two VPSs: an application/database host with Apache, TLS, isolated systemd services, PostgreSQL, and persistent uploads, plus a dedicated Judge0/Playwright sandbox host connected through a WireGuard point-to-point network. The sandbox containers remain on an internal Docker network and fixed-address systemd socket proxies expose only the selected host listeners; the runbook also documents an explicitly accepted fixed-IP firewall-only exception and a shared-stack exception for instances in the same operator trust boundary. It also covers production administrator bootstrap, backups, capacity guidance, and additional isolated Cognelo instances. For the concise tagged-release procedure—including a database backup, optional sandbox update, migration, activation, smoke test, and rollback—use [Upgrading Cognelo](../DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md). Every production GitHub Release must include the explicit upgrade section defined by the [release notes template](../RELEASE_NOTES_TEMPLATE.md); operators are not expected to infer manual actions from code diffs. Before creating a tag or release, the exact current commit must pass all migrations and checks against a freshly supplied production-database clone and receive explicit manual pre-production approval. The tag is then created from that unchanged approved commit.

Judge0 image override:

```text
JUDGE0_IMAGE=ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2
```

Runner base URLs, request authentication, enablement, and Judge0's per-process/thread behavior are database-backed administrator settings under `/settings/runners`; they are not application environment variables. The registry exposes Judge0, Web Design, and SageMath primary entries and permits multiple ordered rows per type for future round-robin selection. The current resolver uses the first enabled runner. Optional auth tokens are encrypted and public API responses expose only whether a token exists. A type with no saved endpoint is presented as disabled; enabling or otherwise saving it requires a valid HTTP(S) base URL, and malformed input must return a validation response rather than an internal error.

Each runner card has a connection-and-capability test. Judge0 verifies authenticated language discovery and a real synchronous sandbox submission. The Web Design runner must answer `GET /health` with `ok: true` and advertise `run` plus `screenshot`. A future SageMath runner must answer the same health contract and advertise `sagemath` plus `execute`; no Sage activity consumes that endpoint yet.

Email credential encryption key:

```text
EMAIL_CREDENTIALS_ENCRYPTION_KEY=<64 hexadecimal characters from `openssl rand -hex 32`>
```

This key encrypts SMTP passwords, Microsoft Graph client secrets, and execution-runner authentication tokens stored in PostgreSQL, and keys the HMAC hashes used for one-time email-verification codes. Keep it stable, instance-specific, backed up with the environment configuration, and outside source control. Email delivery is configured by administrators at `/settings/email`. SMTP works with any relay provider; Microsoft Graph uses an Entra application with `Mail.Send` application permission and administrator consent. The test action may target any valid address and always uses the last saved configuration.

## Frontend Notes

`DialogProvider` renders queued confirmations and text prompts through the accessible shared dialog with localized defaults. Cognelo application and plugin code does not use native `window.alert`, `window.confirm`, or `window.prompt`; sandboxed learner-authored previews may still expose browser modal APIs when that activity explicitly requires them.

- Login, settings, subjects, activity banks, courses, course detail, and edit flows are translated in English, French, and Chinese.
- Locale selection is client-side and persisted in `localStorage`.
- The header and login page use the Cognelo logo from the repo's brand assets.
- The favicon/app icon uses the square Cognelo icon asset served from `apps/web/src/app/icon.png`.
- The top navigation separates primary app routes from the account dropdown.
- Dashboard is temporarily removed from primary navigation. Authentication, the logo, `/`, and legacy `/dashboard` visits first enforce temporary-password replacement and email verification when those account flags require them, then use the first role-available primary route: Subjects for administrators/course managers/teachers, otherwise Courses. Student accounts created by an assigned-password CSV import start verified and do not require a password replacement.
- Account-wide configuration lives under `/settings`, with the current profile and security editor at `/settings/profile`.
- Administrators manage accounts under `/settings/users`, including server-side filters and conventional paged results (10 per page by default, with selectable page sizes), account creation with an initial password, one-or-many global role assignments, email-verification status, explicit confirmation of an unverified account without an emailed code, and temporary-password resets for other users. Account confirmation requires a warning dialog, sets the existing verification timestamp, and removes any outstanding verification challenge. A password reset invalidates existing sessions and requires the user to replace the temporary password at `/change-password` before other authenticated access. New accounts must verify their address at `/verify-email` unless an administrator explicitly confirms the account; changing an account email makes verification required again. Administrators cannot remove their own admin role or use the reset action on themselves.
- Users can update their first and last name and change their password after confirming the current password; email changes are reserved for administrators.
- AI agent connection settings live under `/settings/ai-agents`; users can create personal connections, choose their question-authoring helper, and admins can create global connections for later course use.
- Administrators configure outbound email under `/settings/email` using either an SMTP relay or Microsoft Graph app-only OAuth credentials. Stored passwords/secrets are encrypted and never returned to the browser. The test message can target any valid address. Cognelo uses the guarded system-mail path to send first-login verification codes to active accounts and, when the teacher opts in, grade-challenge answers to the challenging student; all future account and notification messages must use that same eligibility boundary.
- Administrators configure external execution services under `/settings/runners`. Each endpoint has its own configuration and capability test, runner tokens stay encrypted, and dependent plugins resolve only enabled services through core. SageMath is registered for forthcoming symbolic-mathematics and linear-algebra activity plugins but is not otherwise used yet.
- Plugin authoring screens can use the selected question-authoring AI agent through server-side plugin routes; the MCQ plugin uses this to generate validated MCQ source from a teacher description.
- Bank and course activity descriptions serve as student prompts and accept up to 30,000 characters so reading-comprehension activities can include complete passages.
- All core and plugin authoring/settings forms should register unsaved-change state through `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Registered forms show a shared confirmation dialog before internal navigation, with actions to continue editing, save and leave, or discard changes. Browser refresh/close uses the native browser warning.
- Shared dialogs are constrained to the viewport and scroll vertically when their contents exceed the available height, including activity assignment settings with summative gradebook fields.
- Guarded edit forms use the shared responsive `EditActionBar` from `@cognelo/activity-ui` to expose the same draft state visibly: saved/unsaved status, discard-to-last-save, and Save. A page with independent persistence boundaries, such as profile and password or course general and AI settings, uses one bar per boundary; immediately persisted controls stay outside the bar's status.
- Long-running actions use the shared blocking `ProgressDialog` from `@cognelo/activity-ui`. The running state blocks backdrop dismissal, Escape, and background Tab navigation. Batch/import/background-job flows provide real percentage and completed/total values; single AI, runner, validation, synchronization, maintenance, and connection-test requests use the browser's indeterminate progress rendering. Flow-specific notifications or terminal content remain the source of result and error details.
- The subjects area uses a list-first management flow: add subjects from the list header, open a subject detail page, and edit subject metadata from a dedicated edit page.
- Subject descriptions are Markdown-backed rich text. Subject creation and editing reuse the shared visual/Markdown `RichTextEditor`, while the subject detail page renders the sanitized Markdown through the shared renderer. Subject list rows remain compact and show titles without the full rich description.
- Each subject edit page includes a visual knowledge-graph editor built with React Flow in its Knowledge graph tab. Concepts contain stable skill records shown as chips; the plus button adds a skill, and hover/focus actions edit or delete it. Skill and misconception editor dialogs preserve their text-input focus while controlled values rerender. Adds and renames stay in the main Subject draft. Manual deletion uses the shared confirmation dialog; persisted skill/concept deletion is immediate and transactional after impact analysis. AI generation may instead disclose exact removals in its informational change summary and retire those rows atomically with the main Subject save. Any undisclosed omission remains rejected by the deletion guard. A referenced skill can be replaced in current activities by another active skill from the same concept or removed from those mappings. Concept deletion removes its current mappings and prerequisite edges. Historical activity versions remain immutable, while deleted persisted rows are retired for history. Concepts, skill changes, and canvas positions otherwise persist with the main Subject save. The graph rejects self-links, duplicate links, cross-subject links, and cycles; supports routed/traceable edges, dragging, panning, zooming, minimap/viewport controls, workspace and inspector resizing, unsaved-change protection, and restoring the last saved graph. The subject detail page provides a tall pannable/zoomable read-only preview.
- The Subject edit page separates Subject information and knowledge-graph authoring into Information and Knowledge graph tabs. Both tabs share one draft and unsaved-change boundary; switching tabs does not save or discard work. A sticky action bar reports whether changes are pending and saves metadata and graph edits together from either tab.
- Every activity AI authoring panel offers selected, suggested, and ignored knowledge-target modes. Every mode sends the complete subject concept/skill/misconception catalog as a curriculum boundary for generation. Selected mode additionally sends the current on-screen activity target draft. Suggest mode ignores the current selection, maps generated content to exact skills and misconceptions from the subject catalog, and replaces only the unsaved Concepts-tab draft. Ignore mode neither reads nor changes that draft and does not run post-generation mapping. Activity and Concepts tab panels remain mounted while switching, share one draft/save boundary, and a save from either tab persists activity content and knowledge selections together.
- Subjects store a teaching language selected from Cognelo’s supported interface locales. Create and edit forms expose the translated locale list, and the selected value—not the current user-interface locale—controls the language requested from AI-generated subject content, Programming Exercise rubrics, and Programming Exercise assessment feedback.
- Subjects may also store a separate default programming language selected from the unique programming languages currently exposed by the configured Judge0 instance, or declare that they use multiple programming languages. When one language is set, every newly created Programming Exercise in one of the Subject's courses or activity banks—including a locally created child inside a course or reusable bank Test—starts with that language. A missing or multiple-language value gives the new exercise a `--- Choose ---` placeholder instead; saving, AI generation, reference validation, execution, and submission remain unavailable until the author chooses a language. Existing activities and copied activities retain their saved configuration.
- When the current user has selected an enabled question-authoring AI agent, the Subject graph editor exposes a collapsed AI generation section. It accepts optional private directions, a maximum concept count, and either a new-graph or iteration mode. Empty graphs default to new mode; non-empty graphs default to iteration. New mode explicitly ignores the current graph and replaces it after confirmation, warning when the replaced graph has current activity links. Iteration sends the complete current unsaved draft, preserves stable IDs for concepts whose keys remain and skills or misconceptions whose titles remain exact, and asks the model to return a complete revised graph. After an iteration, a one-action informational dialog lists added/deleted concepts, skills, and misconceptions and warns when saving will remove current activity links. Generation uses the current Subject description and teaching-language form selection, requires at least one observable learner skill per concept, asks for specific wrong-belief misconceptions, validates the complete graph and retries invalid model output up to three calls, then places the result only in the form draft. Agent credentials remain server-side. The generated result and its disclosed deletions are persisted atomically with Subject metadata only when the main Save action is used. Legacy `NULL` misconception projections are read as empty, and every save writes an explicit array.
- The Subject graph editor exposes ELK-powered automatic layout presets for hierarchical, forest, radial/star, force-directed, and compact arrangements. Layout operates on the current draft only, supports disconnected components, places prerequisite foundations first for semantic layouts, fits the resulting viewport, and remains reversible until the Subject is saved.
- The course workspace uses one unified Content tab for folders, materials, and activities, with a Course/Group perspective selector aligned after the workspace tabs. Its selected mode expands while inactive modes remain icon-only; Group mode immediately selects the last group used during the current page session or the first alphabetical group, and a browser refresh resets that choice to the first group. Dropdown labels longer than 20 characters are truncated. The same active-expanded pattern is intended for the future Student mode. Teachers manage structure, ordering, creation, settings, and removal in Course mode. Group mode is visibility-only: it inspects effective content and changes per-group visibility without drag handles or remove actions. Manager visits to legacy group URLs return to that selected course-page perspective; student group workspaces remain section-first.
- The course Participants tab replaces the former Groups tab and lists participants directly under each group. Group creation/editing and participant enrollment are modal flows, including fixed-format headerless CSV import for student rosters, so routine roster work no longer requires a separate group page.
- Course workspaces include a Settings tab where teachers can choose the student-support AI agent from their personal connections or admin-managed global connections.
- Activity banks are first-class authoring spaces. Course activities are copied from bank versions rather than edited live in the bank, and activity type labels are localized from plugin registry definitions.
- Activity-bank rows expose a consistent Actions menu. Removing an activity uses the shared accessible confirmation dialog; when course copies exist, the second-stage warning explains that those copies are preserved as independent course-local activities.
- Cookie-authenticated mutation requests are protected centrally by requiring the browser `Origin` header to match `CORS_ORIGIN`. Safe reads and unauthenticated login/activation requests are unaffected; trusted scripts using a session cookie must send the configured origin explicitly.
- `API_PUBLIC_URL` is the externally reachable API origin used inside generated SEB configuration links. It normally equals `NEXT_PUBLIC_API_URL`; in a same-origin Apache deployment all three public URL settings use the application HTTPS origin. Keep it free of a trailing slash and rebuild/restart after changing it.

## Plugin Contributor Workflow

If you are working on a single plugin, start inside that plugin package:

- `packages/plugin-activities/plugin-your-plugin/README.md` for activity plugins
- `packages/plugin-content-types/plugin-your-content-type/README.md` for content type plugins
- the matching plugin-local `PROJECT_MEMORY.md`

For the beginner-friendly plugin authoring handbook, including step-by-step setup, core services, API/web integration, research data patterns, and grading-oriented design guidance, use the [plugin authoring handbook](../plugin-authoring/README.md).

The root README and project memory remain concise entry points. Detailed platform behavior belongs in the canonical topic listed by `docs/README.md`; plugin-specific detail belongs in that plugin's linked reference or decisions document. This keeps unrelated context out of focused development sessions.
