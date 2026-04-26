# Cognelo Architecture

Cognelo is a modular intelligent tutoring system for programming education.

## Stack Rationale

- **Next.js + TypeScript** for both API and web apps: one language, shared types, strong developer experience, and deployable apps without introducing microservices early.
- **PostgreSQL + Prisma** for relational integrity, explicit migrations, and future research-friendly querying.
- **JWT in HttpOnly cookies** for secure browser auth in the MVP, with space for refresh tokens, SSO, invitations, and password reset flows later.
- **Zod contracts** shared between frontend and backend for DTO validation and stable API expectations.
- **Activity registry package** for plugin-style activity registration without coupling activity business logic to subjects, banks, or courses.

## Monorepo Layout

```text
apps/
  api/                 Next.js backend API route handlers
  web/                 Next.js frontend application
packages/
  activity-sdk/        Activity type contract and registry
  config/              Environment loading and validation
  contracts/           Shared DTO schemas and TypeScript types
  core/                Auth, authorization, subject, bank, course, material, activity services
  db/                  Prisma schema, migrations, seed, Prisma client
docs/
  ARCHITECTURE.md      Architecture memory for future sessions
```

## Core Modules

- **Auth** owns password hashing, JWT creation, login/logout, and current-user lookup.
- **Authorization** maps global roles, course memberships, section participants, and activity-bank ownership into permissions.
- **Users/Roles** support many-to-many global roles and future additional roles.
- **Subjects** own reusable curriculum context and subject-level material.
- **Activity banks** own reusable activity authoring and version history for a subject.
- **Courses** own course lifecycle, course-local material, and course-local copies of bank activities.
- **Course materials** are generic records with typed metadata and JSON payloads.
- **Sections** are currently implemented by `CourseGroup` records and own participants plus activity availability windows. The product language should move toward "section"; the generic word "group" is reserved for future concepts.
- **Activities** are typed course-local activity copies and delegate behavior to registered activity modules.

## Content Model

The durable model is:

```text
Subject
  SubjectMaterial
  ActivityBank
    BankActivity
      ActivityVersion
  Course
    CourseMaterial
    Activity
    Section/CourseGroup
      participants
      assigned activities and availability windows
```

Bank activities are authored in activity banks. Each bank save creates a new `ActivityVersion` and updates the bank activity's current version.

When a bank activity is added to a course, Cognelo copies the selected/latest version into a course-local `Activity`. The course activity stores `bankActivityId` and `activityVersionId` for provenance, but the course activity is not live-linked to the bank. Course edits affect only the course copy; bank edits create future versions and do not alter existing course copies.

Plugin-owned private data follows the same rule through server hooks. A plugin can copy its bank-owned reference data into course-owned plugin tables when a course activity is created from a bank version.

## Activity Extensibility

Activity types are registered in `packages/activity-sdk`. Core services store bank activities, activity versions, and course-local activity copies, validate common state, and keep `config` and `metadata` as JSON. Activity-specific validation/rendering/execution is added by registering plugin packages under `packages/plugins/*`.

To add a new activity type:

1. Add or import an `ActivityDefinition`.
2. Register it in the activity registry.
3. Optionally add type-specific config validation.
4. Add frontend renderer/editor components keyed by `activity.activityType.key`.
5. If the plugin has private bank-owned data, add a server plugin hook to copy that data when a bank version becomes a course activity.

No course table rewrite is required.
