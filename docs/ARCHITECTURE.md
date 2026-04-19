# Cognelo Architecture

Cognelo is a modular intelligent tutoring system for programming education.

## Stack Rationale

- **Next.js + TypeScript** for both API and web apps: one language, shared types, strong developer experience, and deployable apps without introducing microservices early.
- **PostgreSQL + Prisma** for relational integrity, explicit migrations, and future research-friendly querying.
- **JWT in HttpOnly cookies** for secure browser auth in the MVP, with space for refresh tokens, SSO, invitations, and password reset flows later.
- **Zod contracts** shared between frontend and backend for DTO validation and stable API expectations.
- **Activity registry package** for plugin-style activity registration without coupling activity business logic to courses.

## Monorepo Layout

```text
apps/
  api/                 Next.js backend API route handlers
  web/                 Next.js frontend application
packages/
  activity-sdk/        Activity type contract and registry
  config/              Environment loading and validation
  contracts/           Shared DTO schemas and TypeScript types
  core/                Auth, authorization, course, material, activity services
  db/                  Prisma schema, migrations, seed, Prisma client
docs/
  ARCHITECTURE.md      Architecture memory for future sessions
```

## Core Modules

- **Auth** owns password hashing, JWT creation, login/logout, and current-user lookup.
- **Authorization** maps global roles and course memberships into permissions.
- **Users/Roles** support many-to-many global roles and future additional roles.
- **Courses** own course lifecycle and metadata, not activity logic.
- **Course materials** are generic records with typed metadata and JSON payloads.
- **Activities** attach typed activity instances to courses and delegate behavior to registered activity modules.

## Activity Extensibility

Activity types are registered in `packages/activity-sdk`. The core `ActivityService` stores activity instances, validates common state, and keeps `config` and `metadata` as JSON. Activity-specific validation/rendering/execution can be added by registering a new handler package later, for example `packages/activity-homework-grader`.

To add a new activity type:

1. Add or import an `ActivityDefinition`.
2. Register it in the activity registry.
3. Optionally add type-specific config validation.
4. Add frontend renderer/editor components keyed by `activity.type.key`.

No course table rewrite is required.
