# Cognelo Architecture

Cognelo is a modular intelligent tutoring system for programming education.

## Stack Rationale

- **Next.js + TypeScript** for both API and web apps: one language, shared types, strong developer experience, and deployable apps without introducing microservices early.
- **PostgreSQL + Prisma** for relational integrity, explicit migrations, and future research-friendly querying.
- **JWT in HttpOnly cookies** for secure browser auth in the MVP, with space for refresh tokens, SSO, invitations, and password reset flows later.
- **Zod contracts** shared between frontend and backend for DTO validation and stable API expectations.
- **Activity and content type registry packages** for plugin-style registration without coupling activity or non-activity content behavior to subjects, banks, courses, or the content tree.

## Monorepo Layout

```text
apps/
  api/                 Next.js backend API route handlers
  web/                 Next.js frontend application
packages/
  activity-sdk/        Activity type contract and registry
  content-type-sdk/    Content type plugin contracts and registry
  config/              Environment loading and validation
  contracts/           Shared DTO schemas and TypeScript types
  core/                Auth, authorization, subject, bank, course, material, activity services
  db/                  Prisma schema, migrations, seed, Prisma client
  plugin-activities/   Activity plugin packages
  plugin-content-types/
                       Non-activity content type plugin packages
docs/
  ARCHITECTURE.md      Architecture memory for future sessions
```

## Core Modules

- **Auth** owns password hashing, JWT creation, login/logout, and current-user lookup.
- **Authorization** maps global roles, course memberships, section participants, and activity-bank ownership into permissions.
- **Users/Roles** support many-to-many global roles and future additional roles.
- **Subjects** own reusable curriculum context, subject-level material, and a subject-scoped prerequisite knowledge graph.
- **Activity banks** own reusable activity authoring and version history for a subject.
- **Courses** own course lifecycle, course-local material, and course-local copies of bank activities.
- **Course content resources** are plugin-backed non-activity resources such as GitHub repos, files, and text notes.
- **Course materials** are legacy generic records retained for compatibility while new non-activity content moves to content type plugins.
- **Sections** are currently implemented by `CourseGroup` records and own participants plus activity availability windows. The product language should move toward "section"; the generic word "group" is reserved for future concepts.
- **Activities** are typed course-local activity copies. Most delegate behavior to installed plugins; core-backed compound activities may use the same generic activity, assignment, content, attempt, and gradebook infrastructure without participating in plugin installation lifecycle.

## Content Model

The durable model is:

```text
Subject
  SubjectMaterial
  SubjectKnowledgeConcept
    SubjectKnowledgePrerequisite (requiring concept -> required concept)
  ActivityBank
    BankActivity
      ActivityVersion
  Course
    CourseContentItem folder tree
    CourseContentResource
    CourseMaterial (legacy compatibility)
    Activity
    Section/CourseGroup
      participants
      assigned activities and availability windows
```

Bank activities are authored in activity banks. Each bank save creates a new `ActivityVersion` and updates the bank activity's current version.

When a bank activity is added to a course, Cognelo copies the selected/latest version into a course-local `Activity`. The course activity stores `bankActivityId` and `activityVersionId` for provenance, but the course activity is not live-linked to the bank. Course edits affect only the course copy; bank edits create future versions and do not alter existing course copies.

Plugin-owned private data follows the same rule through server hooks. A plugin can copy its bank-owned reference data into course-owned plugin tables when a course activity is created from a bank version.

## Activity Extensibility

Activity types are registered in `packages/activity-sdk` with an explicit provider: `plugin` or `core`. Plugin-backed types resolve to an installed activity plugin under `packages/plugin-activities/*`; core-backed types use core services/renderers and do not have plugin installation, activation, backup, or dispatch behavior. Core services store bank activities, activity versions, and course-local activity copies, validate common state, and keep generic `config` and `metadata` as JSON.

The first core-backed definition is `test`. A Test is a compound summative activity whose normalized `TestItem` rows own ordinary plugin-backed child activities. Its dedicated course authoring action is available while the type stays disabled in the generic plugin activity list; child activities are hidden from ordinary course and assignment lists. The outer Test Activity will be the only assignable/content/gradebook unit once runtime is enabled. The implementation sequence and runtime contract live in `docs/TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md`.

To add a new plugin-backed activity type:

1. Add or import an `ActivityDefinition`.
2. Register it in the activity registry.
3. Optionally add type-specific config validation.
4. Add frontend renderer/editor components keyed by `activity.activityType.key`.
5. If the plugin has private bank-owned data, add a server plugin hook to copy that data when a bank version becomes a course activity.

No course table rewrite is required.

## Content Type Extensibility

Content type plugins are the sibling system for non-activity course content. They are registered through `packages/content-type-sdk` and implemented under `packages/plugin-content-types/*`.

Core owns:

- `CourseContentItem` for folder placement, ordering, nesting, and visibility
- `CourseContentResource` for the generic resource row
- `ContentTypePluginInstallation` and `ContentTypePluginTableBackup` for activation, enablement, and backup state
- generic course/group content resource API routes and plugin dispatch

Content type plugins own:

- picker metadata, localized labels, icons, and default titles
- create/update/delete validation
- settings and viewer components registered by renderer key
- plugin routes such as file upload/download
- storage details and plugin-owned tables when generic metadata is not enough
- `getEmbeddingSource` handlers for future indexing

Enabled content type plugins can be selected for new content resources. Active but disabled plugins can still serve existing resources. Inactive or unavailable plugins are blocked at dispatch and existing content rows render as unavailable.

The current content type plugins are:

- `packages/plugin-content-types/plugin-github-repo`
- `packages/plugin-content-types/plugin-file`
- `packages/plugin-content-types/plugin-text`

Embedding readiness is deliberately generic. Core exposes `getContentResourceEmbeddingSource`, which dispatches to the owning content type plugin and returns one of:

```ts
type ContentEmbeddingSource =
  | { kind: "text"; text: string; sourceId: string }
  | { kind: "file"; fileRef: string; mimeType?: string; sourceId: string }
  | { kind: "external_url"; url: string; sourceId: string }
  | { kind: "none"; sourceId: string };
```

There is no embeddings/index database yet. Future activity generation should ask a generic indexing service for relevant course context; it should not import concrete content type plugins directly.
