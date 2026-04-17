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

Implemented platform foundations:

- Authentication uses JWT stored in HttpOnly cookies.
- Global authorization supports many-to-many user roles (`admin`, `teacher`, `student`) and is designed for more roles later.
- Courses support create, edit, archive, and draft/published/archived status.
- Activities are attachable to courses through a plugin-style registry and are not hardcoded into the course model.

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

Internationalization decisions:

- The web app has built-in i18n with `en`, `fr`, and `zh`.
- Locale is stored client-side in `localStorage` and reflected on the document `lang` attribute.
- Visible UI copy is translated across login, navigation, dashboard, course flows, materials UI, and activity management UI.
- Plugin/activity definitions can provide localized `name`, `description`, and `defaultTitle` through the activity registry.
- The course detail page resolves plugin-localized activity labels from registry definitions instead of relying only on database display names.

Known MVP constraints to remember:

- File storage is local only for now; production should move to object storage while preserving the same course-material abstraction.
- Backend/server validation and error messages are not yet fully internationalized.
- Locale-prefixed routes are not implemented; localization is currently app-state driven on the frontend.

Verification habits that have been used successfully:

- Use `npm run typecheck --workspace @cognara/web` for frontend changes.
- Use `npm run build --workspace @cognara/web` to confirm the Next.js app still produces a valid production build.
- Use `npm run db:generate` after Prisma schema changes.

- Seed users:
  - `admin@cognara.local` / `Password123!`
  - `teacher@cognara.local` / `Password123!`
  - `student@cognara.local` / `Password123!`
