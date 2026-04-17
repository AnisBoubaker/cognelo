# Project Memory

The project is a modular ITS platform for programming education.

Important long-term decisions:

- Use a monorepo with separate `apps/api` and `apps/web`.
- Keep auth, authorization, users, courses, materials, and activities in core modules.
- Keep activity business logic out of course models.
- Store research metadata explicitly on activities and activity types.
- Use Prisma/PostgreSQL with normalized tables and JSON fields only for extensible metadata/config.
- Seed users:
  - `admin@cognara.local` / `Password123!`
  - `teacher@cognara.local` / `Password123!`
  - `student@cognara.local` / `Password123!`
