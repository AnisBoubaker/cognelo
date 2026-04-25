# Project Memory

This file is for platform-level memory only.

Plugin-specific behavior, persistence, routes, UX decisions, and implementation notes belong in the owning plugin package under:

- `packages/plugins/plugin-*/README.md`
- `packages/plugins/plugin-*/PROJECT_MEMORY.md`

## Long-Term Platform Decisions

- Use a monorepo with separate `apps/api` and `apps/web`.
- Keep auth, authorization, users, courses, materials, and generic activity orchestration in core modules.
- Keep activity business logic out of course models.
- Store research metadata explicitly on activities and activity types.
- Use Prisma/PostgreSQL with normalized tables and JSON fields only for extensible metadata/config.
- Keep the first version as a modular monorepo, not a microservice split.
- Favor shared contracts and service-layer logic over duplicating validation in each app.
- Treat `docs/PROJECT_MEMORY.md` and `README.md` as living project artifacts that must be updated whenever platform architecture, setup, product behavior, or major cross-cutting capabilities change.
- Treat plugin `README.md` and `PROJECT_MEMORY.md` files as living plugin artifacts that must be updated whenever plugin behavior or plugin-local architecture changes.

## Plugin Architecture Rules

- Activity plugins should be clearly packaged under `packages/plugins/plugin-*`.
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
- Accounts can be activated on first login when a person was pre-added to a group participant list by email and no user record existed yet.
- Courses support create, edit, archive, and draft/published/archived status.
- Activities are attachable to courses through a plugin-style registry and are not hardcoded into the course model.
- Course managers can remove activities directly from the course detail page.

## Group Participant Decisions

- Course groups have explicit participant records separate from platform users.
- Group participants support roles `student`, `ta`, and `teacher`.
- Adding a participant by email links immediately to an existing user when the email already exists.
- When the participant email matches an existing user, first name, last name, and external ID are treated as locked/read-only in the add-participant UI.
- When the participant email does not match an existing user, the group participant record is created without a linked user account, and the actual user account is created only at first activation/login.
- Group creators are automatically added as `teacher` participants when a group is created.
- A manager cannot remove themselves from the participant list of a group.
- Existing-user lookup for participant enrollment is manager-only and happens before submit in the group participant UI.
- Non-manager access to a group is tied to being added as a participant in that group, not only to broad course visibility.
- Student-facing navigation should be group-first: students work from the group workspace, not the broad course workspace.
- Student course access should resolve to visible published groups, and the course detail page should not act as the primary student workspace.
- Student access to assigned activities should be group-scoped and assignment-aware rather than relying on course-level activity routes.
- Student access to inherited course file materials from a group should respect group visibility rules and use group-scoped download routes.

## Course Material Decisions

- Course materials are generic typed records with extensible metadata.
- Implemented material kinds currently include at least `folder`, `github_repo`, and `file`, with room for more later.
- Uploaded files are stored locally for MVP/dev and represented as `file` materials with metadata such as original name, stored name, MIME type, and size.
- GitHub repository materials are validated as `github.com` URLs.
- Course materials support hierarchy through `parentId`, where only folders may be parents.
- Material ordering is explicit via `position`, not implicit by timestamp.
- Material tree operations must prevent moving a folder into one of its own descendants.

## Frontend Platform Decisions

- The course materials area uses a compact table/list layout rather than large cards.
- The add-material form is hidden by default and revealed from the course material section.
- Materials can be edited and removed inline from the course detail page.
- Folders support expand/collapse.
- Material moving uses pointer-based drag and drop with a drag handle, floating preview, target highlighting, and a top-level drop zone.
- Branding uses the project logo from `docs/brand`.
- The app favicon uses the square Cognelo icon asset.
- The top header separates primary app navigation from personal controls.
- The visual theme should reflect the Cognelo logo palette in a restrained, product-like way.
- Syntax-colored code rendering should be shared across activities through `packages/activity-ui`.
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
- Visible platform UI copy is translated across login, navigation, dashboard, course flows, materials UI, and activity management UI.
- Plugin/activity definitions can provide localized `name`, `description`, and `defaultTitle` through the activity registry.
- The course detail page resolves plugin-localized activity labels from registry definitions instead of relying only on database display names.

## Known MVP Constraints

- File storage is local only for now; production should move to object storage while preserving the same course-material abstraction.
- Backend/server validation and error messages are not yet fully internationalized.
- Locale-prefixed routes are not implemented; localization is currently app-state driven on the frontend.
- Plugin registration is explicit, not autodiscovered.
- Judge0 dev infrastructure is local-Docker only; production still requires a separately managed Judge0 host with its own hardening, monitoring, and secrets management.
- Some management-oriented course and group pages still exist for teachers/admins in the same route tree, so student simplicity relies on explicit student-first redirects and rendering branches rather than totally separate apps.

## Verification Habits

- Use `npm run typecheck --workspace @cognelo/web` for frontend-only changes.
- Use `npm run build --workspace @cognelo/web` to confirm the Next.js web app still produces a valid production build.
- Use `npm run db:generate` after Prisma schema changes.
- Use root `npm run typecheck` and `npm run build` when shared packages or both apps are touched.

## Seed Users

- `admin@cognelo.local` / `Password123!`
- `teacher@cognelo.local` / `Password123!`
- `student@cognelo.local` / `Password123!`
