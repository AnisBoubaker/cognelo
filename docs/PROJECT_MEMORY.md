# Project Memory

This file is for platform-level memory only.

Plugin-specific behavior, persistence, routes, UX decisions, and implementation notes belong in the owning plugin package under:

- `packages/plugin-activities/plugin-*/README.md`
- `packages/plugin-activities/plugin-*/PROJECT_MEMORY.md`

## Long-Term Platform Decisions

- Use a monorepo with separate `apps/api` and `apps/web`.
- Keep auth, authorization, users, subjects, activity banks, courses, materials, and generic activity orchestration in core modules.
- Keep activity business logic out of course models.
- Store research metadata explicitly on bank activities, activity versions, course activity copies, and activity types as appropriate.
- Use Prisma/PostgreSQL with normalized tables and JSON fields only for extensible metadata/config.
- Keep the first version as a modular monorepo, not a microservice split.
- Favor shared contracts and service-layer logic over duplicating validation in each app.
- Treat `docs/PROJECT_MEMORY.md` and `README.md` as living project artifacts that must be updated whenever platform architecture, setup, product behavior, or major cross-cutting capabilities change.
- Treat plugin `README.md` and `PROJECT_MEMORY.md` files as living plugin artifacts that must be updated whenever plugin behavior or plugin-local architecture changes.

## Plugin Architecture Rules

- Activity plugins should be clearly packaged under `packages/plugin-activities/plugin-*`.
- Plugin-owned code should not be scattered through core modules or the main web app when it can live inside the plugin package.
- Plugin-specific persistence should be modeled as plugin-owned tables/modules rather than by stretching core tables with plugin-specific columns.
- Plugin-specific HTTP handlers should live in plugin packages. The API app should expose generic dispatcher routes, not one hardcoded Next route file per plugin capability.
- Shared plugin-facing UI belongs in `packages/activity-ui`.
- Shared plugin registries belong in `packages/activity-sdk`.
- Untrusted learner code must run in an external sandbox service, not inside the Cognelo API process.
- Cross-app notifications should use the shared notification service from `@cognelo/activity-ui` (`NotificationProvider` mounted in the web app, `useNotifications()` in core and plugin UI) rather than per-form inline success banners.

## Implemented Platform Foundations

- Authentication uses JWT stored in HttpOnly cookies.
- Global authorization supports many-to-many user roles (`admin`, `teacher`, `student`) and is designed for more roles later.
- Users have account-wide profile settings with editable first and last name fields. Email changes are intentionally admin-only.
- AI agent/model connection settings are account-wide. Personal connections are owned by a user; global connections have no owner and are admin-managed for later teacher/course use.
- Accounts can be activated on first login when a person was pre-added to a group participant list by email and no user record existed yet.
- Courses support create, edit, archive, and draft/published/archived status.
- Users have a generic `metadata` JSON field used for account-level preferences, including the selected AI agent for question authoring help.
- Courses have a generic `metadata` JSON field used for course-level settings, including the selected AI agent for student support.
- Subjects are first-class curriculum containers. A subject can own subject-level materials, activity banks, and courses.
- Activity banks are first-class authoring spaces related to a subject and owned by an individual. Admins can later change ownership and sharing rules.
- Activities are authored in activity banks as `BankActivity` records with version snapshots in `ActivityVersion`.
- Adding an activity from a bank to a course creates a course-local `Activity` copy from the selected/latest `ActivityVersion`.
- Course activity copies keep `bankActivityId` and `activityVersionId` for provenance, but they are not live references.
- Editing a course activity changes only that course copy and what students in that course see.
- Editing a bank activity creates a new version for future course assignments and does not affect existing course copies.
- Plugin copy contract: if a plugin owns private bank-owned data, it must copy that data into course-owned plugin tables through `onCourseActivityCreatedFromBankVersion` when a course activity is created from a bank version. Core only copies the generic `Activity` row and `ActivityVersion` data; plugin-owned tables are the plugin's responsibility.
- New plugins or plugin schema changes that introduce bank-owned private data must include a bank-to-course copy hook and manual verification that the copied course activity has independent plugin-owned rows.
- Plugin delete contract: if a plugin owns bank-owned private data, it must clean those rows through `onBankActivityDeleted` when a bank activity is deleted. Course-owned copied plugin rows must remain intact.
- Deleting a bank activity that is used in courses is allowed only after a second confirmation. Existing course activities lose `bankActivityId` / `activityVersionId` through database `SetNull` relations and become fully course-local copies.
- Activities remain plugin-style registry entries and are not hardcoded into course models.
- Course managers can remove activities directly from the course detail page.
- Gradebook Phase 1 core schema foundation is present in core Prisma: `GradebookItem`, `ActivityAttempt`, `Grade`, and `GradeEvent`. A gradebook item is one assigned group activity (`CourseGroupActivity`) and grades/attempts attach to `CourseGroupParticipant` with optional linked `User`. Plugin-specific attempt artifacts remain plugin-owned; core owns normalized attempt/grade/audit metadata.
- Gradebook Phase 2 lifecycle wiring creates a `GradebookItem` whenever a `CourseGroupActivity` is materialized through direct group assignment, course-wide all-groups assignment, or future-group inheritance of an all-groups rule. Removing the all-groups policy leaves those gradebook items intact because the underlying group assignments remain intact.
- Gradebook Phase 3 core services live in `packages/core/src/gradebook.ts`. They start numbered attempts for assigned group activities, enforce max-attempt and due-date attempt limits, compute lateness on submission, record grading results, and write grade audit events. Plugins can use `getAssignedGroupActivityAttemptSource` from the activity SDK to convert assigned group plugin route context into the core attempt service input shape.
- Gradebook Phase 4 grading contracts are in the activity SDK. Activity definitions can declare grading capabilities, manual grading renderer hints, and plugin grading result payloads. Parsons is the first integrated plugin: it declares attempts/auto/manual grading support and exposes a server grading handler that converts stored Parsons evaluation results into core-compatible raw scores and analytics payloads.
- Gradebook Phase 5 normalization/selection is handled in `recordActivityAttemptGradingResult`. Core scales raw plugin scores to `GradebookItem.pointsPossible`, computes pass/fail from item thresholds, applies late penalties, reconstructs graded attempt history from `GradeEvent` snapshots, and selects the current `Grade` using latest/best/first/weighted-average strategies.
- Gradebook Phase 6 teacher UI includes a course gradebook tab and a group gradebook tab. The API route `GET /api/courses/:courseId/gradebook` returns participant-by-assigned-activity rows, supports group/activity/status filters, and exports CSV with `format=csv`. Missing work is represented by rows for student participants without grades or attempts.
- The course-level teacher gradebook renders activity-level summary rows rather than defaulting to all student/group rows at once. Each activity row shows submission count, graded count, mean grade, release/hide for all assigned groups, a detailed-results link, and an expandable per-group summary with group-specific release/hide controls and group-scoped detailed-results links. Detailed activity results live under `/courses/:courseId/gradebook/activities/:activityId` and can be scoped to one section/group with `?groupId=:groupId`. The group gradebook uses the same activity-summary layout, scoped to the current group. Back links from detailed results return to the course or group workspace with `?tab=gradebook`.
- Assigned group activities have `assessmentMode` metadata. Formative activities keep plugin checks/events for analytics without creating core submissions or grades. Summative activities expose plugin submission flows; for Parsons, submit creates a core attempt, submits it, and records an automatic grade from the Parsons evaluation without showing correctness feedback to the student. New assignments default to formative unless the teacher selects summative. Summative assignment forms expose core gradebook policy settings and persist them to `GradebookItem`: points possible, points/pass-fail mode, pass threshold, attempt limit mode, max attempts, grade strategy, and drop-lowest for weighted averages. If the summative attempt limit is reached, Parsons returns the completed attempt read-only instead of creating a new attempt.
- Gradebook Phase 7 student visibility is implemented. Teachers can release or hide each `GradebookItem` from the course or group gradebook; release/hide changes write participant-scoped grade audit events. Students see a section/group Grades tab backed by `GET /api/courses/:courseId/groups/:groupId/grades`, which returns only released normalized grade summaries and does not expose raw plugin grading payloads, hidden test details, attempt history, or grading timestamps. The same released graded scores are surfaced in the student assigned-activity list and at the top of the student assigned activity page. Released Parsons grades include sanitized deterministic feedback and grading breakdowns from the normalized result: order/indentation feedback messages plus the order/indentation raw-score components.
- Parsons exposes a teacher-only gradebook attempts route through the assigned group plugin dispatcher at `parsons/gradebook-attempts`. The detailed activity results page uses it for the "See answer" overlay, showing submission snapshots by default and optionally including non-submission attempts/events.
- Gradebook Phase 8 manual grading/regrading is implemented. The detailed activity results page resolves plugin-specific manual grading renderers through the activity definition `manualGrading.rendererKey`; Parsons provides the first panel, combining submitted answer review, attempt/event navigation, teacher override score/reason fields, and the existing regrade action. The detailed activity results page also supports bulk Regrade All for submitted/graded attempts and a Grade All Manually page that pages through student attempts 10 at a time. Moving pages or pressing Save persists all visible manual grades and editable student-facing feedback.
- Teachers can delete a specific submitted/graded attempt from the detailed activity "Grade manually" overlay. Core soft-deletes the `ActivityAttempt`, records a `submission_deleted` grade event with the deleted attempt snapshot and reason, and excludes deleted attempts from active submission counts, grading actions, and non-override grade display. If deletion leaves no active submitted attempts, the participant row is shown as missing/did-not-submit rather than retaining a stale attempt-derived score; explicit override grades may remain visible without an active attempt.
- Course content tree Phases 1-10 are implemented. Core Prisma has `CourseContentItem` and `CourseContentItemKind` for the shared folder/material/activity placement tree. Folders are generic course-level structure (`groupId = null`) preserved across groups; group-specific materials and activities may be placed inside those shared folders. Core service logic in `packages/core/src/course-content.ts` creates folders, material items, and activity items; validates course-level parent folders, course/group scope, and folder cycles; computes effective visibility; and lists all or student-visible content. Group content listing returns the shared course structure plus the selected group's content items. API routes under `/api/courses/:courseId/content` and `/api/courses/:courseId/groups/:groupId/content` expose course/group content listing, folder creation, material placement, activity placement, update, and delete. The tree is a placement/order/visibility layer only: materials remain resources, activity availability remains assignment policy, and activity plugin behavior remains isolated behind generic `Activity` and `CourseGroupActivity` references.
- Course content tree Phase 4 is dev-seed driven because there is no production content to preserve. `packages/db/prisma/seed.ts` creates a representative mixed content tree for Programming 101 / Section A with visible and hidden course folders plus materials and activities placed side by side. Existing material/activity tables remain intact while the new tree is exercised through seeded `CourseContentItem` rows.
- Course content tree activity placement is implemented at the service/contract layer. `ActivityInputSchema`, `CourseGroupActivityInputSchema`, and all-groups assignment input accept optional `contentPlacement`. Course activity creation can create a course-scoped activity content item. Direct group assignment can create a group-scoped content item in a selected shared course folder. Course-wide all-groups assignment stores placement metadata and materializes activity content items for current and future groups using the same shared course folder IDs.
- The teacher course page picker is a course-element picker with Activity banks, Material, Programming, and Miscellaneous tabs. It loads shared course folders, lets teachers choose destination folder and visibility, creates course-level folders, creates plugin-backed content resources from enabled content type definitions, and sends `contentPlacement` for local or bank-backed course activity creation. The course page and group teacher page render unified Content tabs; old material-only and activity-only tabs are no longer canonical content management surfaces.
- Student group workspaces render one Content tab backed by the group content endpoint. Effective visibility filters hidden items and descendants of hidden folders. First-level folders render as theme-colored accordions with localStorage persistence keyed per course/group; nested folders keep normal folder-row expand/collapse. Student activity rows carry availability, submission, and released-grade badges, while grade release remains controlled by gradebook APIs.
- Content type plugin Phases 1-12 are implemented. The shared `@cognelo/content-type-sdk` defines frontend/shared and server content type plugin contracts and explicitly wires the concrete content type plugins `@cognelo/plugin-github-repo`, `@cognelo/plugin-file-content`, and `@cognelo/plugin-text-content` from `packages/plugin-content-types/*`. Core Prisma has generic `CourseContentResource`, `ContentTypePluginInstallation`, and `ContentTypePluginTableBackup` models, and `CourseContentItem.kind` now uses `content` instead of `material` while retaining legacy material compatibility. Content type plugin installations mirror activity plugin lifecycle behavior: discovered plugins sync as inactive/disabled, admins activate them before enabling creation, activation can create or restore plugin-owned tables, deactivation backs up owned tables, disabled-but-active plugins may still serve existing resources, and inactive plugins are blocked. `/settings/plugins` is the shared plugin admin surface with separate Activity plugins and Content type plugins tabs. Generic course/group content resource API routes create/update/delete/list plugin-backed resources and dispatch resource plugin routes through active-plugin, authorization, and non-manager content-tree visibility checks. Non-manager content resource listing is filtered by effective content-tree visibility to avoid exposing hidden resource metadata. The web app has a generic content type renderer registry and shared content type icon primitive in `apps/web/src/lib/content-type-renderers.tsx`; the course picker uses only enabled content type definitions, existing resource rows resolve active definitions so disabled active plugins still render, and inactive/unavailable plugin resources show a clear unavailable badge with no open/download action. Core exposes `getContentResourceEmbeddingSource`, which asks the owning server content type plugin for a generic descriptor: text, file, external URL, or none. The GitHub repo, File, and Text plugins implement descriptor handlers, but there is no embeddings/index database yet. The legacy `apps/web/src/lib/material-types.ts` adapter has been removed. The old material tables, routes, and `materialId` fields remain compatibility-only for older local records and downloads, but new canonical course content creation should use `CourseContentResource`. Seed data now creates representative GitHub repo, File, and Text content as plugin-backed resources and deletes the old seed material rows. The GitHub repo content plugin owns GitHub picker metadata, validation/normalization, server create/update/open/embedding handlers, and its settings form; it stores `{ url }` in generic content resource metadata. The File content plugin owns file picker metadata, upload settings UI, local file upload/download plugin routes, file metadata, and file embedding descriptors; it stores file metadata in generic content resource metadata for now. The Text content plugin owns text picker metadata, text settings UI, body create/update behavior, viewer/open-action declaration, and text embedding descriptors; it stores Markdown body data in generic content resource metadata for now. None of the current concrete content type plugins require plugin-owned tables yet. The plugin authoring handbook now covers both activity plugins and content type plugins, including a simple content type plugin tutorial.

## Naming Model

- The user-facing product concept formerly called a course group should move toward "section".
- The current database/service name remains `CourseGroup` during this transition.
- Use "section" in new product copy where feasible, but be careful when referencing existing code paths that still say `groups`.

## Group Participant Decisions

- Course sections/groups have explicit participant records separate from platform users.
- Section/group participants support roles `student`, `ta`, and `teacher`.
- Adding a participant by email links immediately to an existing user when the email already exists.
- When the participant email matches an existing user, first name, last name, and external ID are treated as locked/read-only in the add-participant UI.
- When the participant email does not match an existing user, the group participant record is created without a linked user account, and the actual user account is created only at first activation/login.
- Group creators are automatically added as `teacher` participants when a group is created.
- A manager cannot remove themselves from the participant list of a group.
- Existing-user lookup for participant enrollment is manager-only and happens before submit in the group participant UI.
- Non-manager access to a group is tied to being added as a participant in that group, not only to broad course visibility.
- Student-facing navigation should be section-first: students work from the section workspace, not the broad course workspace.
- Student course access should resolve to visible published sections/groups, and the course detail page should not act as the primary student workspace.
- Student access to assigned activities should be section/group-scoped and assignment-aware rather than relying on course-level activity routes.
- Student access to inherited course file materials from a section/group should respect section/group visibility rules and use section/group-scoped download routes.
- Teachers can assign a course activity to all current and future groups from the course activity list. The course-level rule is stored on the course activity metadata, but it materializes as real `CourseGroupActivity` rows for each group so grading and later group-scoped records can stay attached to the group. Course-wide assignment policy includes `enablePerGroupSettings` and `assessmentMode`: when per-group settings are true, existing group availability dates are preserved and group pages can edit dates; when false, course-level availability replaces group dates and group-local date edits are blocked. Group-local screens must not allow removing assignments whose metadata marks them as course-wide all-group assignments, but teachers may reorder them alongside group-specific assignments. Removing the all-groups rule from the course page must leave existing `CourseGroupActivity` rows in place and remove only the course-wide metadata marker, converting them back to normal group-managed assignments.

## Course Material Decisions

- Course materials are generic typed records with extensible metadata.
- Implemented material kinds currently include at least `folder`, `github_repo`, and `file`, with room for more later.
- Uploaded files are stored locally for MVP/dev and represented as `file` materials with metadata such as original name, stored name, MIME type, and size.
- GitHub repository materials are validated as `github.com` URLs.
- Course material records may still carry legacy `parentId` and `position` fields for compatibility, but `CourseContentItem` is the canonical student-facing hierarchy, ordering, and visibility layer.
- Material tree operations and compatibility code must still prevent moving a legacy material folder into one of its own descendants while the legacy fields remain.

## Frontend Platform Decisions

- Subjects and activity banks are top-level navigation items alongside courses.
- The subjects section follows the same list-first management pattern as other sections: `/subjects` shows the subject list with an Add action, `/subjects/:subjectId` shows linked activity banks/courses, and `/subjects/:subjectId/edit` edits subject metadata.
- Activity bank authoring pages should open the full plugin authoring UI, not only generic metadata.
- Activity bank and course activity creation use picker dialogs grouped by activity categories. The permitted category list and localized category labels live in `@cognelo/activity-sdk`; plugin activity definitions declare `defaultCategoryIds` from that list. Unknown category IDs fall back to `generic`. The special `all` token may be included in the array, such as `["generic", "all"]`, to show an activity in every visible category while still giving it an explicit home category.
- Plugin activity definitions declare default picker metadata such as default category membership and a generic icon name. Activity-bank pages must read that metadata from registered definitions instead of hardcoding plugin activity keys.
- Bank activity authoring pages must resolve plugin-specific authoring UIs through the app activity renderer registry, not by importing plugin packages or branching on plugin activity keys in route components.
- Installed activity plugins are represented by `ActivityPluginInstallation` records. Newly discovered plugins start inactive and disabled. Admins activate a plugin first, then explicitly enable it for activity creation/use.
- Plugin-specific persistence is owned by plugin-local Prisma schemas, migrations, clients, and database modules. The core Prisma schema should not add plugin-owned activity data models.
- Plugin activation syncs activity type records and validates that plugin-owned tables exist. Plugin-local migration statements can create fresh empty plugin-owned tables during activation when the admin does not restore a backup.
- Plugin deactivation disables the plugin and renames its plugin-owned tables into backup tables recorded as `ActivityPluginTableBackup` rows. Reactivation can restore an unrestored backup for the same plugin version.
- Disabled or inactive plugins are removed from activity type listings, hidden from renderer selection for existing activities, and blocked at generic plugin route dispatch.
- The current plugin installation model is manifest-backed and explicitly registered at build time. It is not filesystem autodiscovery yet, but it gives the platform a durable admin-managed enablement layer for later drop-in plugin installation work.
- The unified Content tree uses a compact table/list layout rather than large cards.
- Course workspaces include a Settings tab for course-wide settings. Current settings let teachers choose the student-support AI agent from their personal or global enabled connections.
- Material and activity settings are edited from content-row controls in the unified tree.
- Folders support expand/collapse; student first-level folders render as accordions.
- Content moving uses pointer-based drag and drop with a drag handle, floating preview, target highlighting, a top-level drop zone, and an activation threshold so accidental handle clicks do not immediately move content.
- Branding uses the project logo from `docs/brand`.
- The app favicon uses the square Cognelo icon asset.
- The top header separates primary app navigation from personal controls.
- General account configuration lives under `/settings`, currently reached from the account menu and structured so future non-course-specific settings can be added beside `/settings/profile`.
- AI agent configuration lives under `/settings/ai-agents` and uses the same settings navigation as profile configuration.
- Plugin authoring UIs may expose AI-assisted generation only when the teacher has selected an enabled question-authoring AI agent. Calls should go through server-side plugin routes so stored API keys are never exposed to the browser.
- Future plugin-route client work should reduce plugin-specific web/app wiring: plugin UIs should be able to call their own server routes through a shared client/service rather than requiring new hardcoded methods in `apps/web/src/lib/api.ts` and per-page prop plumbing for each plugin capability.
- AI-assisted generation that writes into existing authoring/configuration fields must ask for confirmation before replacing non-empty content. This applies first to MCQ source generation and should be repeated for future AI-enabled plugins.
- Coding-exercise bank authoring owns private reference solution/template/test data in bank plugin tables and copies those records to course plugin tables on assignment. AI-assisted coding-exercise asset generation must validate the generated reference solution against visible and hidden tests before inserting fields into the form.
- Unsaved-change protection is a shared frontend concern exposed from `@cognelo/activity-ui` and mounted in the web app through `UnsavedChangesProvider`. Every new core or plugin authoring/settings form should register dirty/save/discard behavior with `useUnsavedChangesGuard`; internal links and browser back/forward show the custom dialog, while refresh/close uses the browser-native beforeunload prompt. Main course/profile/subject forms and the MCQ, coding-exercise, Parsons, and web-design-coding-exercise authoring UIs use it.
- The visual theme should reflect the Cognelo logo palette in a restrained, product-like way.
- Syntax-colored code rendering should be shared across activities through `packages/activity-ui`.
- Shared Markdown code rendering highlights fenced code block contents with their declared language, so Markdown authoring editors such as MCQ can show syntax coloring inside ```c-style fences without custom plugin rendering.
- Markdown text rendering for authored prompts/descriptions should be shared across activities and core pages through `packages/activity-ui` rather than reimplemented per plugin.
- The shared code editor should grow vertically with its content.
- Monaco should be exposed as a shared editor primitive through `packages/activity-ui` for student coding flows and future plugin reuse, while lightweight authoring editors can remain plugin-specific or use the in-house editor where that fits better.
- Save confirmations and user-facing error notifications should prefer the shared bottom-right notification system over inline “saved” messages when the message is transient and not tied to a specific field.
- Group participant management uses an inline panel form in the group workspace with an email-first flow.
- Read-only inherited fields in forms should have a visible locked treatment rather than appearing identical to editable fields.
- The student group workspace should stay intentionally minimal: assigned activities and visible course materials only, with no management forms, settings, or participant management.
- Student assigned-activity lists should optimize for compactness and neutral presentation rather than dense manager-style tables or visually ranked cards.

## Internationalization Decisions

- The web app has built-in i18n with `en`, `fr`, and `zh`.
- Locale is stored client-side in `localStorage` and reflected on the document `lang` attribute.
- Visible platform UI copy is translated across login, navigation, dashboard, subject, activity-bank, course, material, and activity management UI.
- Plugin/activity definitions can provide localized `name`, `description`, and `defaultTitle` through the activity registry.
- The course detail page resolves plugin-localized activity labels from registry definitions instead of relying only on database display names.
- Activity bank lists and authoring pages also resolve plugin-localized activity labels from registry definitions instead of relying only on database display names.
- MCQ choices can include fenced code blocks, and MCQ activities can opt into randomized choice display without changing stable choice IDs used for scoring.
- Arabic (`ar`) is supported as a frontend locale. Selecting Arabic sets the document direction to RTL, and plugin activity metadata can provide Arabic `name`, `description`, and `defaultTitle` values.
- Gradebook manual adjustment starts with a core teacher override workflow and a plugin-backed regrade workflow. Overrides update the current grade and write `overridden` grade events; automatic regrades resolve the plugin grading handler and record through the core grade service as `regraded` events. Parsons regrade evaluates the stored submitted attempt state against the current course-local activity config, so teacher corrections to an assigned course activity affect regrade results.

## Known MVP Constraints

- File storage is local only for now; production should move to object storage while preserving the same course-material abstraction.
- Backend/server validation and error messages are not yet fully internationalized.
- Locale-prefixed routes are not implemented; localization is currently app-state driven on the frontend.
- Plugin registration is explicit, not autodiscovered. Installed plugins do have admin-managed enablement records, but adding a new plugin still requires build-time registry wiring.
- Judge0 dev infrastructure is local-Docker only; production still requires a separately managed Judge0 host with its own hardening, monitoring, and secrets management.
- Some management-oriented course and section/group pages still exist for teachers/admins in the same route tree, so student simplicity relies on explicit student-first redirects and rendering branches rather than totally separate apps.
- Plugin registration is explicit, not autodiscovered. This includes server plugin hooks such as copying plugin-owned bank data into course activity copies; missing hook registration means plugin-owned bank data will not be copied.

## Verification Habits

- Use `npm run typecheck --workspace @cognelo/web` for frontend-only changes.
- Use `npm run build --workspace @cognelo/web` to confirm the Next.js web app still produces a valid production build.
- Use `npm run db:migrate:all` after core or plugin Prisma schema changes so core migrations, plugin migration manifests, and generated clients stay aligned.
- Use root `npm test` for the Vitest suite covering contracts, core lifecycle services, API route orchestration, and plugin copy/delete lifecycle contracts.
- Use root `npm run typecheck` and `npm run build` when shared packages or both apps are touched.

## Seed Users

- `admin@cognelo.local` / `Password123!`
- `teacher@cognelo.local` / `Password123!`
- `student@cognelo.local` / `Password123!`
