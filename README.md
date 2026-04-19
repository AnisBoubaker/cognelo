# Cognara

Cognara is a modular ITS foundation for programming education. This first iteration focuses on the core platform: authentication, role-aware course management, generic materials, plugin-ready activities, and a multilingual frontend foundation.

## Architecture Rationale

- **Next.js + TypeScript** powers both the backend API and frontend app, keeping the MVP cohesive while preserving a clean app boundary.
- **PostgreSQL + Prisma** gives the system relational integrity, migrations, and a schema that can grow into enrollment, sections, TAs, invitations, and research analytics.
- **Shared contracts with Zod** keep API validation close to TypeScript types.
- **Activity registry package** keeps activity logic out of the course model. Courses attach activity instances by type, while each plugin owns its own definition, web UI, and database manifest in its own package.
- **Plugin-owned persistence** keeps research-grade attempt data inside the plugin namespace instead of stretching the core activity tables.
- **HttpOnly JWT cookie auth** gives a secure browser default for the MVP.
- **Built-in i18n** gives the web app English, French, and Chinese UI copy, while plugins can provide their own localized labels.

## Folder Structure

```text
apps/
  api/                 Next.js backend API
    src/app/api/       Route handlers
    src/lib/http.ts    CORS, auth cookie, errors, current-user guard
  web/                 Next.js frontend
    src/app/           Login, dashboard, courses, course detail/edit
    src/components/    Auth provider, app shell, forms
    src/lib/api.ts     Browser API client
    public/brand/      Web-ready brand assets used by the UI
packages/
  activity-sdk/        Plugin registry plus activity-definition contracts
  activity-ui/         Shared plugin-facing UI such as code editor/renderer
  config/              Environment validation
  contracts/           Shared DTO schemas and types
  core/                Services and authorization
  db/                  Prisma schema, migration, seed, client
  plugin-placeholder/  Placeholder plugin package
  plugin-homework-grader/
                       Homework grader plugin package
  plugin-parsons/      Parsons plugin package (definition, UI, attempts, DB manifest)
docs/
  ARCHITECTURE.md      Durable architecture notes
  PROJECT_MEMORY.md    Future-session memory
```

## Implemented Backend Modules

- Auth: login, logout, current-user token verification
- Users: `/users/me`
- Authorization: admin/teacher/student global roles plus course memberships
- Courses: create, list, read, update, archive
- Memberships: basic course membership creation
- Materials: generic typed course material records
- Material hierarchy: folders, ordering, upload metadata, and tree-safe move operations
- Activities: typed activity instances with JSON config and research metadata
- Activity types: enabled type listing plus SDK definitions and plugin-localized metadata

## Plugin Packaging

Each activity plugin now lives in its own package under `packages/plugin-*`.

The intended boundary is:

- **Core tables stay generic**: `Activity`, `ActivityType`, `Course`, and related auth/course tables remain shared.
- **Plugin tables belong to the plugin**: plugin-specific persistence should be declared in the plugin package's database module rather than modifying core tables for plugin-specific concerns.
- **Shared services stay shared**: for example, the syntax-colored code editor and code renderer now live in `@cognara/activity-ui` so multiple plugins can reuse them without reaching into the web app internals.

Current plugin packages export:

- activity definitions
- plugin-localized metadata and UI strings
- plugin database manifests
- plugin-owned persistence/services when the activity needs dedicated storage
- plugin-owned web components when the activity has a dedicated interface

## API Endpoints

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
GET    /api/courses
POST   /api/courses
GET    /api/courses/:courseId
PATCH  /api/courses/:courseId
DELETE /api/courses/:courseId
POST   /api/courses/:courseId/memberships
GET    /api/courses/:courseId/materials
POST   /api/courses/:courseId/materials
POST   /api/courses/:courseId/materials/upload
PATCH  /api/courses/:courseId/materials/:materialId
DELETE /api/courses/:courseId/materials/:materialId
GET    /api/courses/:courseId/materials/:materialId/download
GET    /api/activity-types
GET    /api/courses/:courseId/activities
POST   /api/courses/:courseId/activities
GET    /api/courses/:courseId/activities/:activityId
PATCH  /api/courses/:courseId/activities/:activityId
DELETE /api/courses/:courseId/activities/:activityId
POST   /api/courses/:courseId/activities/:activityId/parsons/attempt
PATCH  /api/courses/:courseId/activities/:activityId/parsons/attempt
```

## Authorization Model

- **Admin** can manage all platform resources.
- **Teacher** can create courses and manage courses where they are owner, teacher, or TA.
- **Student** can view courses where they have a membership.
- Course roles are separate from global roles, leaving room for TAs, assistants, section leaders, and future custom roles.

## Database Design

The initial Prisma schema includes:

- `User`
- `Role`
- `UserRole`
- `Course`
- `CourseMembership`
- `CourseMaterial`
- `ActivityType`
- `Activity`
- `PluginParsonsAttempt`
- `PluginParsonsAttemptEvent`

Enums cover course status, course membership role, material kind, and activity lifecycle.

Notable plugin-persistence choices:

- Parsons authoring data still lives in the core `Activity.config`.
- Parsons student attempts live in plugin-owned tables, not in `Activity.config` and not in ad hoc core columns.
- `PluginParsonsAttempt.latestState` stores the student's current block order, indentation, and last evaluation snapshot so an in-progress attempt can resume after reload.
- `PluginParsonsAttemptEvent` records interaction events such as moves, indentation changes, resets, and checks for analytics/research use.

Notable material-model choices:

- `CourseMaterial.parentId` enables folder hierarchy.
- `CourseMaterial.position` controls explicit ordering within a folder/root level.
- `MaterialKind` already includes `folder`, `github_repo`, and `file` in active use, with room for future content types.
- Uploaded files are represented as course materials with structured metadata.

## Seed Accounts

All seeded accounts use `Password123!`.

```text
admin@cognara.local
teacher@cognara.local
student@cognara.local
```

The seed also creates a sample Programming 101 course, starter material, a placeholder activity, and a sample Parsons problem activity.

## Parsons Attempt Persistence

Parsons is the first plugin with dedicated plugin-owned persistence.

- Students now get a persisted in-progress attempt per Parsons activity.
- Reloading the activity restores the latest saved block order and indentation state.
- Correct completion closes the current attempt; the next fresh try starts a new one.
- Teacher/admin previews remain ephemeral so instructor clicks do not pollute student analytics.

This gives the platform a clean base for:

- stuck-student flags
- repeated reset/check patterns
- time-on-task signals
- research exports built from plugin-owned attempt events

## Example API Usage

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@cognara.local","password":"Password123!"}' \
  http://localhost:3001/api/auth/login
```

```bash
curl -b cookies.txt http://localhost:3001/api/users/me
```

```bash
curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title":"Data Structures","description":"Lists, trees, and graphs","status":"draft"}' \
  http://localhost:3001/api/courses
```

```bash
curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"activityTypeKey":"placeholder","title":"Warm-up reflection","lifecycle":"draft","config":{},"metadata":{"researchTags":["warmup"]}}' \
  http://localhost:3001/api/courses/COURSE_ID/activities
```

```bash
curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"title":"Examples de code","kind":"github_repo","url":"https://github.com/org/repo","metadata":{"source":"github"}}' \
  http://localhost:3001/api/courses/COURSE_ID/materials
```

## Run Locally

1. Copy environment values:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d db
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma Client:

```bash
npm run db:generate
```

5. Run migrations:

```bash
npm run db:migrate
```

6. Seed sample data:

```bash
npm run db:seed
```

7. Start both apps:

```bash
npm run dev
```

Open:

```text
Web: http://localhost:3000
API: http://localhost:3001
```

## Frontend UX Notes

- Login, dashboard, courses, course detail, and edit flows are translated in English, French, and Chinese.
- Locale selection is client-side and persisted in `localStorage`.
- The header and login page use the Cognara logo from the repo's brand assets, with a cropped web-ready PNG under `apps/web/public/brand/`.
- The favicon/app icon uses the square Cognara icon asset and is served from `apps/web/src/app/icon.png`.
- The top navigation separates primary app routes from the account dropdown, which contains language selection and logout.
- The web theme is aligned to the Cognara brand palette, using teal/blue/violet accents, navy headings, light surfaces, and restrained branded emphasis.
- Course materials support:
  - GitHub repository links
  - file uploads
  - folders
  - inline edit/remove
  - expand/collapse
  - pointer-based drag and drop with destination highlighting
- Activities now include a first real plugin implementation:
  - `parsons-problem`
  - the activity definition, config schema, UI strings, runtime logic, and web renderer now live under `packages/plugin-parsons`
  - teacher authoring for prompt, reference solution, language, and indentation mode
  - teacher-defined grouping directly from the reference editor gutter, with visible group boxes beside the code
  - precedence rules between groups for “A must come before B” constraints
  - student workspace for reordering code blocks and, optionally, restoring indentation
  - compact editor-style line rendering with syntax coloring and line numbers
- activities can also be removed from the course detail page by course managers

## Plugin i18n

Activity definitions in `packages/activity-sdk` can include:

```ts
i18n: {
  en: { name, description, defaultTitle },
  fr: { name, description, defaultTitle },
  zh: { name, description, defaultTitle }
}
```

The web app uses that localized plugin metadata in the activity picker and on attached activity cards. This lets each plugin carry its own user-facing copy without hardcoding labels into the core UI.

## Adding a New Activity Type

For a new `homework-grader` implementation, add a package such as `packages/activity-homework-grader`, export an `ActivityDefinition`, and register it through the activity SDK. Store common instance data in `Activity`, type metadata in `ActivityType`, and type-specific configuration in `Activity.config`.

The core course model does not change. The frontend can add an editor/renderer keyed by `activity.activityType.key`, while backend services can delegate grading/submission behavior to the registered activity module.

When the plugin needs localized copy, define `i18n` on the activity definition so the core UI can render translated names, descriptions, and default titles without special-case code.

## Parsons Problem

The first real pedagogical activity is `parsons-problem`.

Its current implementation includes:

- teacher setup fields for title, description, prompt, language, and reference solution
- teacher-defined groups created by selecting lines in the reference editor gutter
- visible group boxes aligned beside the editor so teachers can click a group and mark it as fixed-order or flexible
- precedence rules between groups, expressed as arrows from one group to another
- group ranges rebased when the teacher edits the solution, so inserted lines inside a group stay with that group
- automatic generation of scrambled code blocks from the reference solution
- an option to strip indentation from the student version so learners must restore both order and indentation
- a student-facing workspace for reordering blocks and adjusting indentation
- evaluation that accepts any permutation inside flexible groups while still enforcing the configured structure
- order feedback that counts minimally misplaced units, so a small mistake does not look like the whole board is wrong

Current MVP limitation:

- student attempts are not yet persisted to the database; the activity currently focuses on authoring and interactive solving in the browser

Shared frontend note:

- syntax-colored code display is now implemented as a shared web component so future programming activities can reuse the same renderer instead of rolling their own
- supported code-display languages are exposed through a shared dropdown/list so authoring UIs can stay aligned with what the renderer can actually highlight
- a lightweight shared code editor is available for authoring code with syntax coloring and line numbers
- the shared code editor grows vertically with its content so longer authoring tasks stay visible without manual resizing
