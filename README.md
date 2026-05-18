# Cognelo

Cognelo is a modular ITS foundation for programming education. This root README covers the platform itself: core architecture, shared services, setup, and conventions for adding plugins.

Plugin-specific behavior, routes, persistence, and UX notes belong in each plugin package under `packages/plugins/*`.

## Architecture Rationale

- **Next.js + TypeScript** powers both the backend API and frontend app, keeping the MVP cohesive while preserving a clean app boundary.
- **PostgreSQL + Prisma** gives the system relational integrity, migrations, and a schema that can grow into activity versioning, enrollment, sections, TAs, invitations, and research analytics.
- **Shared contracts with Zod** keep API validation close to TypeScript types.
- **Activity registry packages** keep plugin logic out of the subject, activity bank, and course models.
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
  config/              Environment validation
  contracts/           Shared DTO schemas and types
  core/                Services and authorization
  db/                  Prisma schema, migration, seed, client
  plugins/
    plugin-*/          Plugin packages, each with its own README and PROJECT_MEMORY
docs/
  ARCHITECTURE.md      Durable architecture notes
  PROJECT_MEMORY.md    Platform-level memory for future sessions
```

## Core Modules

- Auth: login, logout, current-user token verification
- Users: `/users/me` plus account-wide profile settings
- AI agent connections: account-wide model/provider connection records, with admin-managed global entries
- Authorization: global roles plus course memberships and activity-bank ownership
- Subjects: shared curriculum containers for subject-level material and activity banks
- Activity banks: reusable activity authoring libraries scoped to a subject and owned by an individual
- Courses: create, list, read, update, archive; courses belong to a subject and receive activity copies from banks
- Course settings: course-level AI agent selection for student support
- Memberships: basic course membership creation
- Materials: generic typed course material records
- Activities: typed course-local activity copies with JSON config and research metadata
- Activity types: enabled type listing plus SDK definitions

## Plugin Boundary

Each activity plugin lives in its own package under `packages/plugins/plugin-*`.

The intended boundary is:

- **Core tables stay generic**: `Subject`, `ActivityBank`, `BankActivity`, `ActivityVersion`, `Activity`, `ActivityType`, `Course`, and related auth/course tables remain shared.
- **Plugin tables belong to the plugin**: plugin-specific persistence lives in plugin-local Prisma schemas, migrations, clients, and database modules rather than in the core Prisma schema.
- **Plugin HTTP handlers belong to the plugin**: the API app provides a generic dispatcher route, while plugin-specific subroutes are declared in plugin packages.
- **Bank-to-course copies are explicit**: author in an activity bank, create a new bank version when saving there, and copy the selected version into a course when assigning it to that course. Course edits mutate only the course copy.
- **Plugin activation and enablement are platform-managed**: installed activity plugins have `ActivityPluginInstallation` records. Newly discovered plugins start inactive and disabled; admins activate them first, then enable them when they should be available. Deactivation disables the plugin and renames plugin-owned tables into versioned backup tables that can be restored during reactivation. Plugin-local migrations provide the activation SQL for creating fresh empty plugin-owned tables when reactivated without restoring a backup.
- **Shared services stay shared**: reusable pieces such as the syntax-colored code editor, code renderer, Markdown renderer, and shared notification system live in `@cognelo/activity-ui`.
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

For the beginner-friendly plugin authoring handbook, including step-by-step setup, shared services, persistence patterns, and research/grading guidance, see [docs/plugin-authoring/README.md](docs/plugin-authoring/README.md).

## API Surface

Core endpoints:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
PATCH  /api/users/me
GET    /api/ai-agents
POST   /api/ai-agents
PATCH  /api/ai-agents/:connectionId
DELETE /api/ai-agents/:connectionId
GET    /api/subjects
POST   /api/subjects
GET    /api/subjects/:subjectId
PATCH  /api/subjects/:subjectId
GET    /api/activity-banks
POST   /api/activity-banks
GET    /api/activity-banks/:activityBankId
PATCH  /api/activity-banks/:activityBankId
GET    /api/activity-banks/:activityBankId/activities
POST   /api/activity-banks/:activityBankId/activities
PATCH  /api/activity-banks/:activityBankId/activities/:bankActivityId
DELETE /api/activity-banks/:activityBankId/activities/:bankActivityId
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
GET    /api/courses/:courseId/materials
POST   /api/courses/:courseId/materials
POST   /api/courses/:courseId/materials/upload
PATCH  /api/courses/:courseId/materials/:materialId
DELETE /api/courses/:courseId/materials/:materialId
GET    /api/courses/:courseId/materials/:materialId/download
GET    /api/activity-types
GET    /api/plugins
PATCH  /api/plugins/:pluginKey
GET    /api/courses/:courseId/activities
POST   /api/courses/:courseId/activities
GET    /api/courses/:courseId/activities/:activityId
PATCH  /api/courses/:courseId/activities/:activityId
DELETE /api/courses/:courseId/activities/:activityId
POST   /api/courses/:courseId/activities/:activityId/assign-all-groups
DELETE /api/courses/:courseId/activities/:activityId/assign-all-groups
```

Plugin-specific subroutes are dispatched through:

```text
/api/courses/:courseId/activities/:activityId/[...pluginPath]
/api/activity-banks/:activityBankId/activities/:bankActivityId/[...pluginPath]
/api/courses/:courseId/groups/:groupId/activities/assigned/:activityId/[...pluginPath]
```

Concrete plugin routes are documented in the owning plugin package.

The web app keeps plugin-specific React wiring in the activity renderer registry. Route components should consume registered activity definitions and renderer entries instead of importing plugin packages or branching on concrete plugin keys.

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
- `SubjectMaterial`
- `ActivityBank`
- `BankActivity`
- `ActivityVersion`
- `Course`
- `CourseMembership`
- `CourseMaterial`
- `ActivityType`
- `ActivityPluginInstallation`
- `ActivityPluginTableBackup`
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

Adding a bank activity to a course creates a course-local `Activity` copy from the selected version. The copy keeps `bankActivityId` and `activityVersionId` for traceability, but it is not a live reference. Editing the course copy affects only that course and its students. Editing the bank later creates a new version and does not alter existing course copies.

Course activities can be assigned to every group from the course page. This stores an all-groups policy on the course activity metadata and creates or updates real `CourseGroupActivity` rows for every existing group; future groups inherit those rows at group creation. The policy can enable per-group settings, which preserves existing group availability dates and lets teachers edit dates inside a group. When per-group settings are disabled, course-level availability replaces group dates and group-local date edits are blocked. Assignments also carry an assessment mode: formative activities record plugin checks/events for analytics without gradebook submissions, while summative activities expose plugin submission flows and create gradebook attempts/grades. These course-wide group assignments remain group-related for grading. Removing the all-groups policy leaves the existing group assignment rows in place and converts them back to group-managed assignments.

Each `CourseGroupActivity` assignment has one corresponding `GradebookItem`, created when the assignment is materialized directly, through an all-groups course policy, or by future-group inheritance.

Core gradebook services create numbered `ActivityAttempt` records for assigned group activities, enforce attempt limits, compute lateness at submission time, normalize raw plugin scores to the gradebook item scale, apply pass/fail thresholds and late penalties, select the current grade across attempts, and record grading results with `GradeEvent` audit entries. Plugins keep their private attempt/submission artifacts in plugin tables and call the core services to keep gradebook records consistent.

Teachers can view gradebook rows from the course page or a group page. The gradebook API returns one row per student participant and assigned group activity, including missing work, and supports group, activity, status, and CSV export filters.

Activity plugins can declare grading capabilities, manual grading renderer hints, and core-compatible grading results. Parsons is the first plugin wired into this contract; it advertises attempt, automatic grading, manual grading, and analytics support. Formative Parsons checks stay analytics-only, while summative Parsons submissions create a core attempt and automatic grade from the Parsons evaluation.

Plugins that store private authoring/grading data can participate in the copy step through server plugin hooks. For example, web-design coding exercises copy the private reference bundle and Playwright tests from bank plugin tables into course plugin tables when the course activity is created.

Plugin-owned tables are documented in the owning plugin package rather than in the platform README.

## Seed Accounts

All seeded accounts use `Password123!`.

```text
admin@cognelo.local
teacher@cognelo.local
student@cognelo.local
```

The seed also creates a sample subject, an activity bank with coding/web-design/Parsons examples, a sample course, starter material, a section, and assigned activities for development.

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

Judge0-related environment variables:

```text
JUDGE0_BASE_URL=http://localhost:2358
JUDGE0_AUTH_HEADER=X-Auth-Token
JUDGE0_AUTH_TOKEN=dev-local-token
JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true
```

Web design runner environment variable:

```text
WEB_DESIGN_RUNNER_URL=http://localhost:3456
```

## Frontend Notes

- Login, dashboard, settings, subjects, activity banks, courses, course detail, and edit flows are translated in English, French, and Chinese.
- Locale selection is client-side and persisted in `localStorage`.
- The header and login page use the Cognelo logo from the repo's brand assets.
- The favicon/app icon uses the square Cognelo icon asset served from `apps/web/src/app/icon.png`.
- The top navigation separates primary app routes from the account dropdown.
- Account-wide configuration lives under `/settings`, with the current profile editor at `/settings/profile`.
- Users can update their first and last name from profile settings; email changes are reserved for administrators.
- AI agent connection settings live under `/settings/ai-agents`; users can create personal connections, choose their question-authoring helper, and admins can create global connections for later course use.
- Plugin authoring screens can use the selected question-authoring AI agent through server-side plugin routes; the MCQ plugin uses this to generate validated MCQ source from a teacher description.
- All core and plugin authoring/settings forms should register unsaved-change state through `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Registered forms show a shared confirmation dialog before internal navigation, with actions to continue editing, save and leave, or discard changes. Browser refresh/close uses the native browser warning.
- The subjects area uses a list-first management flow: add subjects from the list header, open a subject detail page, and edit subject metadata from a dedicated edit page.
- Course materials support links, uploads, folders, edit/remove, expand/collapse, and drag/drop ordering.
- Course workspaces include a Settings tab where teachers can choose the student-support AI agent from their personal connections or admin-managed global connections.
- Activity banks are first-class authoring spaces. Course activities are copied from bank versions rather than edited live in the bank, and activity type labels are localized from plugin registry definitions.

## Plugin Contributor Workflow

If you are working on a single plugin, start inside that plugin package:

- `packages/plugins/plugin-your-plugin/README.md`
- `packages/plugins/plugin-your-plugin/PROJECT_MEMORY.md`

For the beginner-friendly plugin authoring handbook, including step-by-step setup, core services, API/web integration, research data patterns, and grading-oriented design guidance, use [docs/plugin-authoring/README.md](docs/plugin-authoring/README.md).

The convention is:

- platform-wide decisions live in the root `README.md` and `docs/PROJECT_MEMORY.md`
- plugin-specific decisions live in the plugin's own `README.md` and `PROJECT_MEMORY.md`

That way someone can clone the project and work almost entirely inside a plugin directory, including in a Codex session focused on that plugin.
