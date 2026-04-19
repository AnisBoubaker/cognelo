# Cognara

Cognara is a modular ITS foundation for programming education. This root README covers the platform itself: core architecture, shared services, setup, and conventions for adding plugins.

Plugin-specific behavior, routes, persistence, and UX notes belong in each plugin package under `packages/plugins/*`.

## Architecture Rationale

- **Next.js + TypeScript** powers both the backend API and frontend app, keeping the MVP cohesive while preserving a clean app boundary.
- **PostgreSQL + Prisma** gives the system relational integrity, migrations, and a schema that can grow into enrollment, sections, TAs, invitations, and research analytics.
- **Shared contracts with Zod** keep API validation close to TypeScript types.
- **Activity registry packages** keep plugin logic out of the course model.
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
  activity-ui/         Shared plugin-facing UI such as code editor/renderer
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
- Users: `/users/me`
- Authorization: global roles plus course memberships
- Courses: create, list, read, update, archive
- Memberships: basic course membership creation
- Materials: generic typed course material records
- Activities: typed activity instances with JSON config and research metadata
- Activity types: enabled type listing plus SDK definitions

## Plugin Boundary

Each activity plugin lives in its own package under `packages/plugins/plugin-*`.

The intended boundary is:

- **Core tables stay generic**: `Activity`, `ActivityType`, `Course`, and related auth/course tables remain shared.
- **Plugin tables belong to the plugin**: plugin-specific persistence is declared in the plugin package's database module rather than by modifying core tables for plugin-specific concerns.
- **Plugin HTTP handlers belong to the plugin**: the API app provides a generic dispatcher route, while plugin-specific subroutes are declared in plugin packages.
- **Shared services stay shared**: reusable pieces such as the syntax-colored code editor and code renderer live in `@cognara/activity-ui`.

Plugin packages can export:

- activity definitions
- localized metadata and UI strings
- database manifests
- persistence/services
- server route definitions
- web components
- plugin-local `README.md` and `PROJECT_MEMORY.md`

## API Surface

Core endpoints:

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
```

Plugin-specific subroutes are dispatched through:

```text
/api/courses/:courseId/activities/:activityId/[...pluginPath]
```

Concrete plugin routes are documented in the owning plugin package.

## Authorization Model

- **Admin** can manage all platform resources.
- **Teacher** can create courses and manage courses where they are owner, teacher, or TA.
- **Student** can view courses where they have a membership.
- Course roles are separate from global roles, leaving room for TAs, assistants, section leaders, and future custom roles.

## Database Design

Core Prisma entities include:

- `User`
- `Role`
- `UserRole`
- `Course`
- `CourseMembership`
- `CourseMaterial`
- `ActivityType`
- `Activity`

Enums cover course status, course membership role, material kind, and activity lifecycle.

Plugin-owned tables are documented in the owning plugin package rather than in the platform README.

## Seed Accounts

All seeded accounts use `Password123!`.

```text
admin@cognara.local
teacher@cognara.local
student@cognara.local
```

The seed also creates a sample course, starter material, and sample activities for development.

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

## Frontend Notes

- Login, dashboard, courses, course detail, and edit flows are translated in English, French, and Chinese.
- Locale selection is client-side and persisted in `localStorage`.
- The header and login page use the Cognara logo from the repo's brand assets.
- The favicon/app icon uses the square Cognara icon asset served from `apps/web/src/app/icon.png`.
- The top navigation separates primary app routes from the account dropdown.
- Course materials support links, uploads, folders, edit/remove, expand/collapse, and drag/drop ordering.

## Plugin Contributor Workflow

If you are working on a single plugin, start inside that plugin package:

- `packages/plugins/plugin-your-plugin/README.md`
- `packages/plugins/plugin-your-plugin/PROJECT_MEMORY.md`

The convention is:

- platform-wide decisions live in the root `README.md` and `docs/PROJECT_MEMORY.md`
- plugin-specific decisions live in the plugin's own `README.md` and `PROJECT_MEMORY.md`

That way someone can clone the project and work almost entirely inside a plugin directory, including in a Codex session focused on that plugin.
