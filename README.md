# Cognelo

Cognelo is a modular intelligent tutoring system (ITS) for programming education. This root README covers the platform itself: core architecture, shared services, setup, and conventions for adding plugins.

For a public overview of Cognelo, its educational approach, and the project, visit the [official Cognelo website](https://cognelo.org/).

Plugin-specific behavior, routes, persistence, and UX notes belong in each plugin package under `packages/plugin-activities/*` for activities and `packages/plugin-content-types/*` for non-activity course content.

## Architecture Rationale

- **Next.js + TypeScript** powers both the backend API and frontend app, keeping the MVP cohesive while preserving a clean app boundary.
- **PostgreSQL + Prisma** gives the system relational integrity, migrations, and a schema that can grow into activity versioning, enrollment, sections, TAs, invitations, and research analytics.
- **Shared contracts with Zod** keep API validation close to TypeScript types.
- **Activity and content type registry packages** keep plugin logic out of subject, activity bank, course, and content tree models.
- **Plugin-owned persistence and routes** keep plugin-specific concerns out of core tables and out of hardcoded API files.
- **HttpOnly JWT cookie auth** gives a secure browser default for the MVP.
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
  STUDENT_MODEL_IMPLEMENTATION_PLAN.md
                       Planned stable skills, learning evidence, mastery projection, and product rollout
```

## Core Modules

- Auth: login, logout, current-user token verification
- Users: `/users/me` plus account-wide profile settings
- Admin user management: list/filter accounts by role, first name, last name, or email; create accounts; and edit account names, emails, and multi-role assignments
- AI agent connections: account-wide model/provider connection records, with admin-managed global entries
- Authorization: global roles plus course memberships and activity-bank ownership
- Subjects: shared curriculum containers with an explicit teaching language, subject-level material, activity banks, and subject-scoped knowledge graphs with draggable nodes and reconnectable arrow endpoints
- Activity banks: reusable activity authoring libraries scoped to a subject and owned by an individual
- Courses: create, list, read, update, archive; courses belong to a subject and receive activity copies from banks
- Course settings: course-level AI agent selection for student support
- Memberships: basic course membership creation
- Course content tree: shared placement, ordering, folder nesting, and visibility for folders, legacy materials, plugin-backed content resources, and activities
- Section-specific folder visibility overrides preserve the shared course folder structure while allowing each section to hide or show a folder independently
- Content resources: plugin-backed non-activity course content such as GitHub repos, uploaded files, and Markdown text
- Materials: legacy generic typed course material records retained for compatibility while new content uses content type plugins
- Activities: typed course-local activity copies with JSON config and research metadata
- Activity knowledge links: every bank and course activity editor receives a core-owned Concepts tab for linking the activity to its subject knowledge graph; AI authoring can use selected skills, suggest replacement skill links, or ignore knowledge links
- Activity types: enabled type listing plus SDK definitions

## Plugin Boundary

Activity plugins live under `packages/plugin-activities/plugin-*`. Content type plugins live under `packages/plugin-content-types/plugin-*`.

The Coding Homework Grader is registered as `coding-homework-grader` in `packages/plugin-activities/plugin-coding-homework-grader`; its phased design lives in `docs/CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md`. The plugin implements teacher authoring, activity-owned assignment files, prior-documentation snapshot/extraction, C parsing, ZIP preflight and final submission validation, submitted-function candidate analysis, background challenge-question generation, student challenge answers, core gradebook attempts, and teacher manual grading. Its behavior and persistence remain plugin-owned rather than extending core Prisma. Course content extraction and reference similarity are requested through the shared content type plugin server interface; content-specific text/PDF/repository extraction stays inside the owning content type plugins.

The intended boundary is:

- **Core tables stay generic**: `Subject`, `ActivityBank`, `BankActivity`, `ActivityVersion`, `Activity`, `ActivityType`, `CourseContentResource`, `CourseContentItem`, `Course`, and related auth/course tables remain shared.
- **Plugin tables belong to the plugin**: plugin-specific persistence lives in plugin-local Prisma schemas, migrations, clients, and database modules rather than in the core Prisma schema.
- **Plugin HTTP handlers belong to the plugin**: the API app provides a generic dispatcher route, while plugin-specific subroutes are declared in plugin packages.
- **Plugin dispatch authorization is fail-closed**: course activity plugin routes require course-management permission, bank plugin routes require bank-management permission, assigned group routes require authorized group access, and content-plugin mutations require course-management permission. Route definitions must explicitly name their supported activity/content type keys or they are not dispatchable.
- **Content type behavior belongs to content type plugins**: validation, settings forms, plugin routes, storage behavior, open/download behavior, extracted embedding/reference documents, and content-resource extraction/chunking logic live in `packages/plugin-content-types/*`; production vector persistence/search should use shared platform vector services.
- **Bank-to-course copies are explicit**: author in an activity bank, create a new bank version when saving there, and copy the selected version into a course when assigning it to that course. Course edits mutate only the course copy.
- **Linked course copies synchronize explicitly**: course managers can inspect whether the course copy, latest published bank version, or both changed. Retrieval preserves course placement and assignments; publishing creates a new immutable bank version. Every mutation is blocked after any attempt, and publishing requires bank write access.
- **Plugin activation and enablement are platform-managed**: installed activity plugins have `ActivityPluginInstallation` records. Newly discovered plugins start inactive and disabled; admins activate them first, then enable them when they should be available. Deactivation disables the plugin and renames plugin-owned tables into versioned backup tables that can be restored during reactivation. Plugin-local migrations provide the activation SQL for creating fresh empty plugin-owned tables when reactivated without restoring a backup.
- **Content type activation mirrors activity plugins**: installed content type plugins have `ContentTypePluginInstallation` records. Enabled content type plugins can create new resources; active but disabled plugins may still serve existing resources; inactive/unavailable plugins render existing rows with an unavailable state.
- **Shared services stay shared**: reusable pieces such as the syntax-colored code editor, code renderer, Markdown renderer, Markdown-backed rich-text editor, and shared notification system live in `@cognelo/activity-ui`. Future plugin fields that need visual rich-text editing must reuse the shared `RichTextEditor`; plugins should not create competing WYSIWYG implementations.
- **Remote execution stays outside the API app**: activities that run learner code should call an external sandbox service such as Judge0 from server-side plugin routes.

Plugin packages can export:

- activity definitions
- default picker metadata such as category membership and generic icon name
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

For the beginner-friendly plugin authoring handbook, including step-by-step setup, shared services, persistence patterns, and research/grading guidance, see [docs/plugin-authoring/README.md](docs/plugin-authoring/README.md).

## API Surface

Core endpoints:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/health
GET    /api/users/me
PATCH  /api/users/me
PUT    /api/users/me/password
GET    /api/users
POST   /api/users
PATCH  /api/users/:userId
GET    /api/ai-agents
POST   /api/ai-agents
PATCH  /api/ai-agents/:connectionId
DELETE /api/ai-agents/:connectionId
GET    /api/subjects
POST   /api/subjects
GET    /api/subjects/:subjectId
PATCH  /api/subjects/:subjectId
POST   /api/subjects/:subjectId/concepts
PATCH  /api/subjects/:subjectId/concepts/:conceptId
GET    /api/subjects/:subjectId/concepts/:conceptId
DELETE /api/subjects/:subjectId/concepts/:conceptId
GET    /api/subjects/:subjectId/concepts/:conceptId/skills/:skillId
DELETE /api/subjects/:subjectId/concepts/:conceptId/skills/:skillId
POST   /api/subjects/:subjectId/prerequisites
DELETE /api/subjects/:subjectId/prerequisites/:prerequisiteId
POST   /api/subjects/:subjectId/knowledge-graph/generate
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

Concrete plugin routes are documented in the owning plugin package.

The web app keeps plugin-specific React wiring in registries: activity renderers in `apps/web/src/lib/activity-renderers.tsx`, and content type settings/rendering in `apps/web/src/lib/content-type-renderers.tsx`. Route components should consume registered definitions and renderer entries instead of importing plugin packages or branching on concrete plugin keys.

## Authorization Model

- **Admin** can manage all platform resources.
- **Course manager** can create subjects and courses.
- **Teacher** can create activity banks, own/manage their banks, and manage courses where they are owner, teacher, or TA.
- **Student** can view course sections where they are registered.
- Course roles are separate from global roles, leaving room for TAs, assistants, section leaders, and future custom roles.

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
    BankActivity
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

Activity banks are reusable authoring libraries. A bank activity keeps a mutable current record plus immutable `ActivityVersion` snapshots. Saving in the bank creates a new version for future course use.

The activity-bank list exposes creation plus owner/admin edit and delete actions while preserving row navigation into each bank. Title and description are editable; subject is editable only while the bank is empty. Deleting a populated bank either moves its activities, in order, to another writable bank under the same subject or requires a second confirmation to delete all bank contents. Existing course-local activity copies survive destructive bank deletion with their bank/version traceability links cleared.

Bank activity row actions can duplicate an activity as a new independent version-1 record, including plugin-owned private authoring data, or move the existing activity and its complete history to another writable bank under the same subject. The duplicate dialog defaults the editable title to the source title plus ` (copy)` and increments an existing terminal suffix as ` (copy #2)`, ` (copy #3)`, and so on. Both actions append the resulting activity at the end of its bank.

Each bank activity row with at least two versions exposes **Compare versions** in its actions menu, opening a shared diff visualizer without crowding the activity editor. Core provides semantic comparisons for title, description, lifecycle, activity type, and concept/skill selections, plus recursive structured diffs for generic activity config and metadata. Multiline changes preserve line breaks, show only nearby contextual hunks, highlight exact changed characters, and expand Markdown `##` question changes to the containing question. Unchanged fields are omitted. Plugin-private authoring rows are not included because they are not currently snapshotted per `ActivityVersion`.

Course content activity actions can similarly duplicate an activity with an editable, sequence-aware copy title. The copy is an unassigned draft placed in the same content folder with the same local visibility, retains the source `bankActivityId` and `activityVersionId` traceability when present, copies knowledge selections and plugin-owned private course authoring data, and deliberately omits the source all-groups assignment policy. Compound Tests use their dedicated deep-copy service so their child activities are duplicated too.

The same course Content action also duplicates GitHub, file, and text resources plus compatibility legacy materials into the original folder with the original visibility. Content type plugins own their duplication semantics; uploaded file copies share the immutable stored file reference, while derived embedding indexes are discarded so a copy can be indexed under its new resource identity.

Knowledge-concept selection is a mandatory platform capability rather than an activity-plugin option. The host application wraps every activity authoring surface in an Activity/Concepts tab set. The Concepts tab orders prerequisite foundations first, then uses prerequisite count and localized title as deterministic tie-breakers. Its two-column selector shows concepts on the left and the active concept's skills on the right. Teachers can select a whole concept or exact skill lines; whole-concept selection is deliberately distinct from selecting every current skill individually. Links are normalized core data: bank selections are snapshotted onto each `ActivityVersion`, copied when that version becomes a course activity, and then edited independently on the course copy. Teachers may leave the selection empty, but plugins cannot remove the Concepts tab.

Adding a bank activity to a course creates a course-local `Activity` copy from the selected version. The copy keeps `bankActivityId` and `activityVersionId` for traceability, but it is not a live reference. Editing the course copy affects only that course and its students. Editing the bank later creates a new version and does not alter existing course copies.

Course activities can be assigned to every group from the course page. This stores an all-groups policy on the course activity metadata and creates or updates real `CourseGroupActivity` rows for every existing group; future groups inherit those rows at group creation. The policy can enable per-group settings, which preserves existing group availability dates and lets teachers edit dates inside a group. When per-group settings are disabled, course-level availability replaces group dates and group-local date edits are blocked. Assignments also carry an assessment mode: formative activities record plugin checks/events for analytics without gradebook submissions, while summative activities expose plugin submission flows and create gradebook attempts/grades. Summative assignment forms also configure the gradebook item policy, including points, pass/fail thresholds, attempt limits, and grade selection strategy. These course-wide group assignments remain group-related for grading. Removing the all-groups policy leaves the existing group assignment rows in place and converts them back to group-managed assignments.

Each `CourseGroupActivity` assignment has one corresponding `GradebookItem`, created when the assignment is materialized directly, through an all-groups course policy, or by future-group inheritance.

`CourseContentItem` provides the canonical course content tree: shared placement, ordering, nesting, and visibility for folders, materials, and activities without merging their domain behavior. Folders are generic course content structure, live at the course level, and are preserved across groups; group-specific materials and activities can be placed inside those shared folders. Materials remain non-assigned resources, while activities remain generic course or group assignment records with plugin-owned behavior isolated in plugin packages. Core course/group content APIs can create folders, place materials, place activities, move/update items, delete items, and list all or effectively visible content items. Activity creation and assignment contracts can optionally carry `contentPlacement` so activity rows and group assignments can create matching content-tree activity items.

Visibility is content-tree state and is separate from activity availability. A visible upcoming or expired activity can still be locked by assignment policy, while a hidden item or a descendant of a hidden folder is omitted from student content. The same effective-visibility rule is enforced when a non-manager requests an assigned activity or one of its plugin routes directly; hiding is an access boundary, not only a rendering choice. Student group workspaces render a single Content tab with first-level folders as accordions; teachers manage the same unified content tree from course and group workspaces. The older material-only and activity-only workspace tabs are no longer the canonical content management surface.

Course content resources are now plugin-backed through content type plugins. The current content type plugins are GitHub repo, File, and Text under `packages/plugin-content-types/*`. The course picker reads enabled content type definitions, while existing content rows can still render through active disabled plugins. Folders remain generic core content tree items rather than plugins.

Each content type plugin can expose `getEmbeddingDocuments`, `indexEmbeddingDocuments`, and `searchEmbeddingDocuments` handlers. Core exposes generic dispatchers so indexing or activity-generation code can ask for extracted documents and vector similarity without importing concrete content plugins. Content-specific extraction/chunking stays in the owning content type plugin. The current development implementation uses deterministic embeddings and plugin-owned resource metadata; production should use common platform pgvector tables behind the same handler contract so activity plugins can search all relevant course content across content types.

Core gradebook services create numbered `ActivityAttempt` records for assigned group activities, enforce attempt limits, compute lateness at submission time, normalize raw plugin scores to the gradebook item scale, apply pass/fail thresholds and late penalties, select the current grade across attempts, and record grading results with `GradeEvent` audit entries. Plugins keep their private attempt/submission artifacts in plugin tables and call the core services to keep gradebook records consistent.

Teachers can view gradebook rows from the course page or a group page. The gradebook API returns one row per student participant and assigned group activity, including missing work, and supports group, activity, status, and CSV export filters.

Teachers can release or hide final grades per gradebook item from the course or group gradebook. Release/hide changes are audited with participant-scoped `GradeEvent` rows. Before release, a repeatable summative activity—unlimited, until-due, or a maximum greater than one—shows the student their latest provisional attempt result and plugin-supported attempt review so feedback can guide another attempt. Releasing publishes the final grade selected by the configured latest/best/first/weighted strategy and prevents further attempts. A single-attempt summative grade remains hidden until release. Student responses remain normalized and do not expose raw plugin grading payloads or hidden Test details.

The course gradebook defaults to an activity summary table. Each row shows submission count, graded count, mean grade, release/hide for all assigned groups, and a detailed-results link; expanding a row shows group-level summaries and group-specific release/hide controls. The group gradebook uses the same activity summary layout scoped to the current group. The detailed activity results page lists per-student results and can be scoped to one group from the course or group gradebook. It offers an aggregate **Review all** report for standalone and compound activities: MCQ choice analysis, Parsons solution/error/grade distributions, coding and web-design solutions plus one pass/fail summary for every individual grading test, and a global-solution fallback for other activity types. Parsons also provides an individual teacher answer-review overlay, with previous/next submission navigation and an option to include non-submission attempts/events.

Teachers can manually override a student's current grade from the detailed activity results page. Overrides replace the current grade, clear the selected attempt link, and write an `overridden` grade event with previous/next grade snapshots and the teacher reason. Teachers can also trigger an automatic regrade for the selected/latest submitted attempt when the plugin exposes a server grading handler; the platform records the result as a `regraded` grade event. Parsons is the first plugin wired into this regrade path.

Activity plugins can declare grading capabilities, manual grading renderer hints, and core-compatible grading results. Parsons is the first plugin wired into this contract; it advertises attempt, automatic grading, manual grading, and analytics support. Formative Parsons checks stay analytics-only, while summative Parsons submissions create a core attempt and automatic grade from the Parsons evaluation.

Plugins that store private authoring/grading data can participate in the copy step through server plugin hooks. For example, web-design coding exercises copy the private reference bundle and Playwright tests from bank plugin tables into course plugin tables when the course activity is created.

Plugin-owned tables are documented in the owning plugin package rather than in the platform README.

## Seed Accounts

All seeded accounts use `Password123!`.

The application does not prefill the sign-in form. Browsers and password managers may offer saved credentials through the standard username and password autocomplete fields.
The login submit control uses an explicit non-native appearance so Safari autofill cannot repaint its gradient away while retaining white text.

```text
admin@cognelo.local
teacher@cognelo.local
student@cognelo.local
```

The seed also creates a sample subject, an activity bank with coding/web-design/Parsons/Coding Homework Grader examples, a sample course, starter materials, a section, assigned activities, and a mixed course content tree for development. The seeded content tree includes visible and hidden folders with materials and activities placed side by side.

The Coding Homework Grader seed fixture creates `Coding homework grader: INF-155 TP1 Labyrinthe` in Programming 101 / Section A, with the extracted `tmp/INF155-A2023-TP1.pdf` assignment text, a copied assignment PDF attachment when the local file exists, ZIP structure requirements based on `tmp/FichiersFournis`, a ready prior-documentation snapshot, a summative group assignment, and a gradebook item. It also creates `seed-ai-agent-student-support` for the separate course student-support AI setting. Challenge question generation uses a course teacher/owner's configured non-local question-authoring AI connection; the seed preserves existing teacher preferences and does not silently route challenge generation to local Ollama.

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

Local Compose defaults to `ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2`, the Cognelo-tested Apple Silicon development image. Docker Desktop uses Judge0's per-process/thread limit fallback because it does not delegate a usable cgroup-v2 subtree; this is for trusted local development and is not equivalent to production cgroup isolation. The development worker pool is capped at two because Docker Desktop reports the host CPU count and a large automatically sized pool can collide over isolate boxes. Its C, C++, Go, Java, JavaScript, Python, Rust, and TypeScript runtimes have been validated with real compile/execute and stdin/stdout submissions. Set `JUDGE0_IMAGE` to override the image. The Ubuntu production runbook continues to use the official pinned Judge0 image on its supported Linux sandbox host. Cognelo stops AI test correction immediately when every reference run fails at compilation or with a Judge0 internal error, because changing generated tests cannot repair the execution environment.

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

5. Seed sample data:

```bash
npm run db:seed
```

6. Run automated checks:

```bash
npm run typecheck
npm test
```

The test suite uses Vitest for contracts, core service behavior, API route orchestration, and plugin lifecycle contracts. It intentionally does not include browser E2E tests yet.

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

The initial production runbook is [docs/DEPLOYMENT_UBUNTU_APACHE.md](docs/DEPLOYMENT_UBUNTU_APACHE.md). Its production reference uses two VPSs: an application/database host with Apache, TLS, isolated systemd services, PostgreSQL, and persistent uploads, plus a dedicated Judge0/Playwright sandbox host connected only through a WireGuard point-to-point network. It also covers production administrator bootstrap, backups, capacity guidance, and additional isolated Cognelo instances. For the concise tagged-release procedure—including a database backup, optional sandbox update, migration, activation, smoke test, and rollback—use [docs/DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md](docs/DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md). Every production GitHub Release must include the explicit upgrade section defined by [docs/RELEASE_NOTES_TEMPLATE.md](docs/RELEASE_NOTES_TEMPLATE.md); operators are not expected to infer manual actions from code diffs. Before creating a tag or release, the exact current commit must pass all migrations and checks against a freshly supplied production-database clone and receive explicit manual pre-production approval. The tag is then created from that unchanged approved commit.

Judge0-related environment variables:

```text
JUDGE0_BASE_URL=http://localhost:2358
JUDGE0_IMAGE=ghcr.io/anisboubaker/judge0-arm64:1.13.1-dev.2
JUDGE0_AUTH_HEADER=X-Auth-Token
JUDGE0_AUTH_TOKEN=dev-local-token
JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true
```

Web design runner environment variable:

```text
WEB_DESIGN_RUNNER_URL=http://localhost:3456
```

## Frontend Notes

- Login, settings, subjects, activity banks, courses, course detail, and edit flows are translated in English, French, and Chinese.
- Locale selection is client-side and persisted in `localStorage`.
- The header and login page use the Cognelo logo from the repo's brand assets.
- The favicon/app icon uses the square Cognelo icon asset served from `apps/web/src/app/icon.png`.
- The top navigation separates primary app routes from the account dropdown.
- Dashboard is temporarily removed from primary navigation. Authentication, the logo, `/`, and legacy `/dashboard` visits use the first role-available primary route: Subjects for administrators/course managers/teachers, otherwise Courses.
- Account-wide configuration lives under `/settings`, with the current profile and security editor at `/settings/profile`.
- Administrators manage accounts under `/settings/users`, including server-side filters and conventional paged results (10 per page by default, with selectable page sizes), account creation with an initial password, and one-or-many global role assignments. Administrators cannot remove their own admin role.
- Users can update their first and last name and change their password after confirming the current password; email changes are reserved for administrators.
- AI agent connection settings live under `/settings/ai-agents`; users can create personal connections, choose their question-authoring helper, and admins can create global connections for later course use.
- Plugin authoring screens can use the selected question-authoring AI agent through server-side plugin routes; the MCQ plugin uses this to generate validated MCQ source from a teacher description.
- Bank and course activity descriptions serve as student prompts and accept up to 30,000 characters so reading-comprehension activities can include complete passages.
- All core and plugin authoring/settings forms should register unsaved-change state through `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Registered forms show a shared confirmation dialog before internal navigation, with actions to continue editing, save and leave, or discard changes. Browser refresh/close uses the native browser warning.
- Shared dialogs are constrained to the viewport and scroll vertically when their contents exceed the available height, including activity assignment settings with summative gradebook fields.
- Guarded edit forms use the shared responsive `EditActionBar` from `@cognelo/activity-ui` to expose the same draft state visibly: saved/unsaved status, discard-to-last-save, and Save. A page with independent persistence boundaries, such as profile and password or course general and AI settings, uses one bar per boundary; immediately persisted controls stay outside the bar's status.
- The subjects area uses a list-first management flow: add subjects from the list header, open a subject detail page, and edit subject metadata from a dedicated edit page.
- Subject descriptions are Markdown-backed rich text. Subject creation and editing reuse the shared visual/Markdown `RichTextEditor`, while the subject detail page renders the sanitized Markdown through the shared renderer. Subject list rows remain compact and show titles without the full rich description.
- Each subject edit page includes a visual knowledge-graph editor built with React Flow in its Knowledge graph tab. Concepts contain stable skill records shown as chips; the plus button adds a skill, and hover/focus actions edit or delete it. Adds and renames stay in the main Subject draft. Every deletion uses the shared confirmation dialog; persisted skill/concept deletion is immediate and transactional after impact analysis. A referenced skill can be replaced in current activities by another active skill from the same concept or removed from those mappings. Concept deletion removes its current mappings and prerequisite edges. Historical activity versions remain immutable, while deleted persisted rows are retired for history. Concepts, skill changes, and canvas positions otherwise persist with the main Subject save. The graph rejects self-links, duplicate links, cross-subject links, and cycles; supports routed/traceable edges, dragging, panning, zooming, minimap/viewport controls, workspace and inspector resizing, unsaved-change protection, and restoring the last saved graph. The subject detail page provides a tall pannable/zoomable read-only preview.
- The Subject edit page separates Subject information and knowledge-graph authoring into Information and Knowledge graph tabs. Both tabs share one draft and unsaved-change boundary; switching tabs does not save or discard work. A sticky action bar reports whether changes are pending and saves metadata and graph edits together from either tab.
- Every activity AI authoring panel offers `Use selected skills`, `Suggest skills`, and `Ignore skills`. Every mode sends the complete subject concept/skill catalog as a curriculum boundary for generation. Selected mode additionally sends the current on-screen activity skill draft as specific generation targets. Suggest mode ignores the current selection, maps the generated activity to exact skills from the subject catalog, and replaces only the unsaved Concepts-tab draft. Ignore mode neither reads nor changes that draft and does not run post-generation skill mapping. Activity and Concepts tab panels remain mounted while switching, share one draft/save boundary, and a save from either tab persists activity content and knowledge selections together.
- Subjects store a teaching language selected from Cognelo’s supported interface locales. Create and edit forms expose the translated locale list, and the selected value—not the current user-interface locale—controls the language requested from AI-generated subject content.
- When the current user has selected an enabled question-authoring AI agent, the Subject graph editor exposes a collapsed AI generation section. It accepts optional private directions, a maximum concept count, and either a new-graph or iteration mode. Empty graphs default to new mode; non-empty graphs default to iteration. New mode explicitly ignores the current graph and replaces it after confirmation, while iteration sends the complete current unsaved draft and asks the model to return a complete revised graph. Generation uses the current Subject description and teaching-language form selection, requires at least one observable learner skill per concept, validates the complete graph and retries invalid model output up to three calls, then places the result only in the form draft. Agent credentials remain server-side. The generated result is persisted atomically with Subject metadata only when the main Save action is used.
- The Subject graph editor exposes ELK-powered automatic layout presets for hierarchical, forest, radial/star, force-directed, and compact arrangements. Layout operates on the current draft only, supports disconnected components, places prerequisite foundations first for semantic layouts, fits the resulting viewport, and remains reversible until the Subject is saved.
- Course and group workspaces use a unified Content tab for folders, materials, and activities. Teachers can manage shared course folders, place course-wide or group-specific content inside them, toggle content visibility, drag/drop reorder content, and configure material/activity-specific settings from content rows.
- Course workspaces include a Settings tab where teachers can choose the student-support AI agent from their personal connections or admin-managed global connections.
- Activity banks are first-class authoring spaces. Course activities are copied from bank versions rather than edited live in the bank, and activity type labels are localized from plugin registry definitions.
- Activity-bank rows expose a consistent Actions menu. Removing an activity uses the shared accessible confirmation dialog; when course copies exist, the second-stage warning explains that those copies are preserved as independent course-local activities.
- Cookie-authenticated mutation requests are protected centrally by requiring the browser `Origin` header to match `CORS_ORIGIN`. Safe reads and unauthenticated login/activation requests are unaffected; trusted scripts using a session cookie must send the configured origin explicitly.

## Plugin Contributor Workflow

If you are working on a single plugin, start inside that plugin package:

- `packages/plugin-activities/plugin-your-plugin/README.md` for activity plugins
- `packages/plugin-content-types/plugin-your-content-type/README.md` for content type plugins
- the matching plugin-local `PROJECT_MEMORY.md`

For the beginner-friendly plugin authoring handbook, including step-by-step setup, core services, API/web integration, research data patterns, and grading-oriented design guidance, use [docs/plugin-authoring/README.md](docs/plugin-authoring/README.md).

The convention is:

- platform-wide decisions live in the root `README.md` and `docs/PROJECT_MEMORY.md`
- plugin-specific decisions live in the plugin's own `README.md` and `PROJECT_MEMORY.md`

That way someone can clone the project and work almost entirely inside a plugin directory, including in a Codex session focused on that plugin.
