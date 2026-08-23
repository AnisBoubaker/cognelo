# Cognelo Architecture

Cognelo is a modular intelligent tutoring system for programming education.

## Stack Rationale

- **Next.js + TypeScript** for both API and web apps: one language, shared types, strong developer experience, and deployable apps without introducing microservices early.
- **PostgreSQL + Prisma** for relational integrity, explicit migrations, and future research-friendly querying.
- **JWT in HttpOnly cookies** for secure browser auth in the MVP, with authentication-version invalidation for administrator password resets and space for refresh tokens, SSO, and invitations later.
- **Zod contracts** shared between frontend and backend for DTO validation and stable API expectations.
- **Activity and content type registry packages** for plugin-style registration without coupling activity or non-activity content behavior to subjects, banks, courses, or the content tree.

## Production Topology

The production reference is a two-host deployment. The application VPS runs Apache/TLS, the Next.js web and API services, background jobs, PostgreSQL, and durable uploaded storage. A separate disposable sandbox VPS runs the privileged Judge0 stack and the constrained Playwright runner, with no Cognelo database credentials, JWT secret, application deploy key, or mounted application storage.

The hosts communicate through an instance-specific WireGuard point-to-point network. Judge0 and Playwright bind only to the sandbox WireGuard address, never its public interface, and firewall rules admit their ports only from the matching application WireGuard peer. The API systemd unit orders itself after WireGuard with `Wants` rather than `Requires`; a sandbox or tunnel outage may disable execution-backed activities but must not prevent the rest of Cognelo from starting. PostgreSQL remains loopback-only on the application host. The complete operational procedure and initial capacity guidance live in `docs/DEPLOYMENT_UBUNTU_APACHE.md`.

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

Shared cross-plugin frontend primitives live in `packages/activity-ui`. In addition to editors, renderers, notifications, and unsaved-navigation guards, it owns the responsive `EditActionBar` used by guarded edit drafts and the portal-based `ContextMenu` used by row/action menus. `ContextMenu` renders outside clipping containers, flips and clamps to the viewport, and centralizes dismissal behavior; new contextual menus must use it instead of page-local absolute positioning. The action bar is presentational and receives the owning form's dirty, saving, save, and discard state; it does not merge persistence boundaries or infer whether unrelated immediate mutations are saved.

The API applies centralized Origin-based CSRF protection to every unsafe request carrying the HttpOnly session cookie. Generic plugin dispatch is also an authorization boundary: course and bank authoring dispatchers require management permission, assigned group dispatch validates group assignment access, unsafe content-resource plugin methods require course management, and registrations without explicit supported type keys fail closed.

## Core Modules

- **Auth** owns password hashing, JWT creation, authentication-version checks, login/logout, forced-password-change gating, first-login email-verification gating, and current-user lookup. New accounts remain restricted to current-user, password-change, verification, and logout endpoints until their address is verified. Six-digit verification codes expire after 10 minutes, have a 60-second resend cooldown and five-attempt limit, and are stored only as HMAC-SHA256 hashes.
- **Authorization** maps global roles, course memberships, section participants, and activity-bank ownership into permissions.
- **Users/Roles** support many-to-many global roles and future additional roles. Admin-only user management lists and filters accounts, creates active accounts with initial passwords, edits identity plus global role assignments, displays verification status, and issues temporary passwords to other users. A reset increments `User.authVersion`, marks `mustChangePassword`, invalidates older JWTs, and restricts the next authenticated session to current-user/password endpoints until replacement. Changing an account email clears `emailVerifiedAt` and any outstanding challenge.
- **Email delivery** owns one global admin-managed sender and transport configuration. It supports vendor-neutral SMTP relay and Microsoft Graph app-only OAuth. SMTP passwords and Graph client secrets are AES-256-GCM encrypted in PostgreSQL with the instance-specific `EMAIL_CREDENTIALS_ENCRYPTION_KEY`; that key also protects email-verification code hashes, and public DTOs expose only secret-presence flags. The admin test path may target any valid email address. The reusable system-mail path rejects recipients unless they are active users or unclaimed section participants awaiting activation; first-login verification uses it for active accounts and renders the subject, text, HTML language, and direction from the requesting UI locale. No other invitation or notification workflow sends mail yet.
- **Subjects** own reusable curriculum context, a supported teaching-language locale used by subject AI generation, subject-level material, and a subject-scoped prerequisite knowledge graph.
- **Activity AI authoring** receives knowledge alignment through a host-owned shared context. Every generation mode receives the complete subject concept/skill catalog as a curriculum boundary. Generators can additionally consume the live unsaved skill draft as specific targets, request catalog-constrained skill suggestions for their generated draft, or ignore the selection draft without reading or mutating it. The host keeps both tab panels mounted and combines activity content with knowledge selections at the persistence boundary.
- **Activity banks** own reusable activity authoring and version history for a subject. Bank management is capability-gated (currently owner/admin), subject changes are allowed only while empty, and populated-bank deletion either transfers activities to a writable same-subject bank or cascades bank content after explicit confirmation while preserving detached course-local copies.
- **Bank activity lifecycle hooks** keep generic duplicate operations plugin-neutral. Core creates an independent unpublished draft with no version history, while activity plugins copy any private bank-owned authoring rows through `onBankActivityDuplicated`; its first publish creates version 1. Moving retains the existing activity identity and therefore needs no plugin data migration.
- **Bank activity version comparison** is core-owned for immutable `ActivityVersion` data. A shared diff contract and `@cognelo/activity-ui` visualizer compare semantic core fields, knowledge selections, and recursive generic config/metadata paths. This gives every activity type a consistent fallback without plugin UI code. Private plugin authoring data remains outside historical comparison until it is version-snapshotted alongside each activity version.
- **Course activity duplication** creates an unassigned draft in the source content folder, preserves bank activity/version traceability and core concept selections, removes the all-groups assignment policy, and delegates private course-row copying to `onCourseActivityDuplicated`. Compound Tests use their dedicated deep-copy lifecycle while preserving the same-folder placement rule.
- **Course activity bank synchronization** reports in-sync, course-ahead, bank-ahead, or diverged state by comparing the linked course copy, its immutable imported version, and the latest published bank version. Retrieval updates the existing course and plugin-owned authoring data without changing placement or assignments. Publishing creates a new immutable version and delegates private course-to-bank replacement to `onCourseActivityPublishedToBank`. Any attempt locks both directions; bank writes require bank-management permission.
- **Content resource duplication** is content-type-owned through server `duplicate` handlers, allowing generic course content orchestration without interpreting file, repository, or text metadata. Core creates the copied resource and same-folder content placement only after the owning plugin returns safe copied metadata.
- **Courses** own course lifecycle, course-local material, and course-local copies of bank activities.
- **Course content resources** are plugin-backed non-activity resources such as GitHub repos, files, and text notes.
- **Course materials** are legacy generic records retained for compatibility while new non-activity content moves to content type plugins.
- **Sections** are currently implemented by `CourseGroup` records and own participants plus activity availability windows. The course Participants tab manages all section rosters inline with modal group/participant forms. Group deletion is transactional and cannot remove the final course group; participants can be deduplicated into another group, or permanently removed with their group-scoped gradebook records after explicit confirmation. The product language should move toward "section"; the generic word "group" is reserved for future concepts.
- **Activities** are typed course-local activity copies. Most delegate behavior to installed plugins; core-backed compound activities may use the same generic activity, assignment, content, attempt, and gradebook infrastructure without participating in plugin installation lifecycle.
- **Standalone activity response drafts** persist bounded JSON state per assigned activity and student participant without starting or consuming a gradebook attempt. Interactive standalone renderers use a serialized state host, while plugins with richer draft models may retain their plugin-owned persistence. Final submission clears the generic draft on a best-effort basis. Compound Test children never use this table; they continue to autosave through `TestItemAttempt` under the parent Test attempt.

## Content Model

The durable model is:

```text
Subject
  SubjectMaterial
  SubjectKnowledgeConcept
    SubjectKnowledgePrerequisite (requiring concept -> required concept)
  ActivityBank
    BankActivity
      BankActivityKnowledgeConcept
      ActivityVersion
        ActivityVersionKnowledgeConcept
  Course
    CourseContentItem folder tree
    CourseContentResource
    CourseMaterial (legacy compatibility)
    Activity
      ActivityKnowledgeConcept
    Section/CourseGroup
      participants
      assigned activities and availability windows
```

`SubjectKnowledgeSkill` gives every observable skill a stable subject/concept-scoped identity, title, position, and active/retired state. `SubjectKnowledgeConcept.skills` remains a synchronized newline-delimited compatibility projection for older contracts and AI graph generation. Renaming or reordering a skill preserves its ID. Confirmed deletion retires the row, updates current mappings, and preserves immutable historical snapshots.

Bank activities are mutable drafts. Saving as Draft updates only the bank activity. Saving as Published creates a new immutable `ActivityVersion` when authored content differs from the latest published snapshot; publishing unchanged content reuses that version. Pausing or archiving is lifecycle-only and does not create a version. `currentVersionId` therefore represents the latest published version, even while newer draft edits exist.

Activity-to-concept links are a core, cross-plugin contract. All activity editors are host-wrapped with an Activity/Concepts tab set. Bank links are copied into immutable activity-version link rows and then into independent course-activity link rows during assignment; empty selections are valid, but no activity type may opt out of the capability.

Each bank, version, and course activity concept link stores `selectsAllSkills`, stable `selectedSkillIds`, and `selectedSkills` title snapshots. A whole-concept selection uses `selectsAllSkills = true`; an explicit selection of every skill still uses `false`. Immutable activity versions snapshot concrete skill IDs/titles. Deleting a skill can replace it with another active skill in the same concept or remove it from current bank/course activities; deleting a concept removes its current mappings. Historical activity-version snapshots are never rewritten. Attempts snapshot their resolved skill mapping at start.

When a bank activity is added to a course, Cognelo copies the selected/latest version into a course-local `Activity`. The course activity stores `bankActivityId` and `activityVersionId` for provenance, but the course activity is not live-linked to the bank. Course edits affect only the course copy; bank edits create future versions and do not alter existing course copies.

Plugin-owned private data follows the same rule through server hooks. A plugin can copy its bank-owned reference data into course-owned plugin tables when a course activity is created from a bank version.

## Activity Extensibility

Activity types are registered in `packages/activity-sdk` with an explicit provider: `plugin` or `core`. Plugin-backed types resolve to an installed activity plugin under `packages/plugin-activities/*`; core-backed types use core services/renderers and do not have plugin installation, activation, backup, or dispatch behavior. Core services store bank activities, activity versions, and course-local activity copies, validate common state, and keep generic `config` and `metadata` as JSON. The shared activity description is the student prompt and allows up to 30,000 characters for passage-based activities.

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

Effective content visibility is also an authorization input. A group may override the visibility of any inherited course content item without mutating the course default; group-specific placements retain their stored visibility and ordering. When a group assignment shadows an inherited course activity placement, core returns the inherited placement with the selected assignment identity merged into it, so visibility, folder placement, ordering, and actions never come from conflicting rows. Student content listings omit hidden items and descendants of hidden folders, and non-manager assigned-activity resolution applies the same rule before serving the activity or dispatching any activity plugin route. Teachers manage structure in Course perspective and use Group perspective only to inspect effective content and override visibility; separate group workspaces remain student-facing.

Content type plugins own:

- picker metadata, localized labels, semantic icon names rendered by the web app's centralized Tabler icon layer, and default titles
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
