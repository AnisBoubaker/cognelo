# Project Memory

The project is a modular ITS platform for programming education.

Important long-term decisions:

- Use a monorepo with separate `apps/api` and `apps/web`.
- Keep auth, authorization, users, courses, materials, and activities in core modules.
- Keep activity business logic out of course models.
- Store research metadata explicitly on activities and activity types.
- Use Prisma/PostgreSQL with normalized tables and JSON fields only for extensible metadata/config.
- Keep the first version as a modular monorepo, not a microservice split.
- Favor shared contracts and service-layer logic over duplicating validation in each app.
- Treat `docs/PROJECT_MEMORY.md` and `README.md` as living project artifacts that must be updated whenever architecture, setup, product behavior, or major implementation capabilities change.

Implemented platform foundations:

- Authentication uses JWT stored in HttpOnly cookies.
- Global authorization supports many-to-many user roles (`admin`, `teacher`, `student`) and is designed for more roles later.
- Courses support create, edit, archive, and draft/published/archived status.
- Activities are attachable to courses through a plugin-style registry and are not hardcoded into the course model.
- The first real pedagogical plugin is `parsons-problem`.
- Course managers can remove activities directly from the course detail page.

Course material decisions:

- Course materials are generic typed records with extensible metadata.
- Implemented material kinds currently include at least `folder`, `github_repo`, and `file`, with room for more later.
- Uploaded files are stored locally for MVP/dev and represented as `file` materials with metadata such as original name, stored name, MIME type, and size.
- GitHub repository materials are validated as `github.com` URLs.
- Course materials support hierarchy through `parentId`, where only folders may be parents.
- Material ordering is explicit via `position`, not implicit by timestamp.
- Material tree operations must prevent moving a folder into one of its own descendants.

Frontend UX decisions currently in place:

- The course materials area uses a compact table/list layout rather than large cards.
- The add-material form is hidden by default and revealed from the course material section.
- Materials can be edited and removed inline from the course detail page.
- Folders support expand/collapse.
- Material moving uses pointer-based drag and drop with:
  - a dedicated drag handle
  - a floating drag preview
  - valid drop target highlighting
  - a top-level drop zone for moving items back to root
- Branding uses the project logo from `docs/brand`, with a cropped web-ready asset copied to `apps/web/public/brand/cognara-logo-tight.png`.
- The web app uses the real Cognara logo in the main header and login screen rather than plain text branding.
- The app favicon uses `docs/brand/cognara_icon.png`, resized and copied to `apps/web/src/app/icon.png` for Next.js metadata/app-icon handling.
- The top header separates primary app navigation from personal controls: dashboard/courses/new course stay in primary nav, while language and logout live in an account dropdown anchored by the user identity.
- The visual theme should reflect the logo palette: bright teal, blue, and violet accents over light neutral surfaces, with the darker navy from the wordmark used for headings and key text.
- Keep the branding influence subtle and product-like: use restrained gradients, tinted hero panels, and soft shadows rather than loud decorative backgrounds.
- Syntax-colored code rendering should be shared across activities. The web app now has a reusable code renderer component for line-numbered, syntax-highlighted code displays.
- When an activity lets teachers choose a programming language for display/highlighting, prefer a shared dropdown backed by the renderer's supported-language list instead of free-text language entry.
- The web app also has a lightweight shared code editor component for authoring code with syntax coloring and line numbers; Parsons reference solutions should use it instead of a plain textarea.
- The shared code editor should grow vertically with its content so longer authoring tasks are comfortable without relying on manual resize gestures.

Internationalization decisions:

- The web app has built-in i18n with `en`, `fr`, and `zh`.
- Locale is stored client-side in `localStorage` and reflected on the document `lang` attribute.
- Visible UI copy is translated across login, navigation, dashboard, course flows, materials UI, and activity management UI.
- Plugin/activity definitions can provide localized `name`, `description`, and `defaultTitle` through the activity registry.
- The course detail page resolves plugin-localized activity labels from registry definitions instead of relying only on database display names.

Activity/plugin notes:

- `parsons-problem` is configured through activity `config`, not special database columns.
- Current Parsons config includes:
  - `prompt`
  - `solution`
  - `language`
  - `stripIndentation`
  - `groups`
  - `precedenceRules`
- The student workspace currently supports block reordering plus indentation adjustment when `stripIndentation` is enabled.
- Parsons student rendering uses a compact editor-like row layout with shared syntax highlighting and line numbers.
- Parsons lines can be activated by click/toggle and then manipulated with keyboard arrow keys: up/down reorder, left/right adjust indentation when indentation mode is enabled.
- Scrambled Parsons blocks are generated from the teacher-authored solution rather than stored separately.
- Parsons scrambling should be random on each fresh try/reset rather than fixed per activity.
- Parsons authoring now uses editor-adjacent line selection and visible group boxes instead of a separate line-to-group assignment form.
- Parsons groups are stored as line ranges, not per-line selects, so inserting lines inside a group should keep those new lines inside the group after rebasing.
- Parsons supports group-based partial ordering: teachers can define groups, mark them strict or flexible internally, and add explicit precedence rules between groups.
- Parsons order feedback should count minimally misplaced units rather than every downstream displaced line, so small mistakes produce believable feedback.
- Current Parsons attempts are interactive in the browser only and are not yet persisted as submissions/attempt records.

Known MVP constraints to remember:

- File storage is local only for now; production should move to object storage while preserving the same course-material abstraction.
- Backend/server validation and error messages are not yet fully internationalized.
- Locale-prefixed routes are not implemented; localization is currently app-state driven on the frontend.

Verification habits that have been used successfully:

- Use `npm run typecheck --workspace @cognara/web` for frontend changes.
- Use `npm run build --workspace @cognara/web` to confirm the Next.js app still produces a valid production build.
- Use `npm run db:generate` after Prisma schema changes.
- Use root `npm run typecheck` and `npm run build` when activity changes touch shared packages plus both apps.

- Seed users:
  - `admin@cognara.local` / `Password123!`
  - `teacher@cognara.local` / `Password123!`
  - `student@cognara.local` / `Password123!`
