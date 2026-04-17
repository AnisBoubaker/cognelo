# Cognara

Cognara is a modular ITS foundation for programming education. This first iteration focuses on the core platform: authentication, role-aware course management, generic materials, plugin-ready activities, and a multilingual frontend foundation.

## Architecture Rationale

- **Next.js + TypeScript** powers both the backend API and frontend app, keeping the MVP cohesive while preserving a clean app boundary.
- **PostgreSQL + Prisma** gives the system relational integrity, migrations, and a schema that can grow into enrollment, sections, TAs, invitations, and research analytics.
- **Shared contracts with Zod** keep API validation close to TypeScript types.
- **Activity registry package** keeps activity logic out of the course model. Courses attach activity instances by type, while type-specific behavior can live in later packages.
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
packages/
  activity-sdk/        Activity definition and registry
  config/              Environment validation
  contracts/           Shared DTO schemas and types
  core/                Services and authorization
  db/                  Prisma schema, migration, seed, client
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
PATCH  /api/courses/:courseId/activities/:activityId
DELETE /api/courses/:courseId/activities/:activityId
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

Enums cover course status, course membership role, material kind, and activity lifecycle.

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

The seed also creates a sample Programming 101 course, starter material, a placeholder activity, and a future homework-grader activity type.

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
- Course materials support:
  - GitHub repository links
  - file uploads
  - folders
  - inline edit/remove
  - expand/collapse
  - pointer-based drag and drop with destination highlighting

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
