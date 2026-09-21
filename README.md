# Cognelo

Cognelo is a modular intelligent tutoring system for programming education. The platform is a TypeScript monorepo with separate Next.js API and web applications, PostgreSQL/Prisma persistence, and explicit activity and course-content plugin boundaries.

For the public project overview, visit [cognelo.org](https://cognelo.org/).

## Start Here

- [Documentation index](docs/README.md): choose only the documents relevant to the task.
- [Architecture](docs/ARCHITECTURE.md): stable system boundaries and repository layout.
- [Project memory](docs/PROJECT_MEMORY.md): short cross-cutting invariants and easy-to-miss constraints.
- [Platform details](docs/reference/PLATFORM_DETAILS.md): exhaustive product, API, setup, seed, and UI reference formerly kept in this README.
- [Plugin authoring handbook](docs/plugin-authoring/README.md): activity and content-type plugin development.

Plugin-specific behavior belongs with the plugin:

- activity plugins: `packages/plugin-activities/plugin-*`
- content-type plugins: `packages/plugin-content-types/plugin-*`

Each plugin README is an entry point. Its `PROJECT_MEMORY.md` contains only durable implementation constraints and links to deeper plugin references when needed.

## Repository Map

```text
apps/
  api/                  Next.js API
  web/                  Next.js frontend
packages/
  activity-sdk/         Activity plugin contracts and registries
  activity-ui/          Shared activity UI
  content-type-sdk/     Content-type plugin contracts and registries
  contracts/            Shared Zod schemas and DTOs
  core/                 Shared services and authorization
  db/                   Core Prisma schema, migrations, seed, and client
  plugin-activities/    Activity plugins
  plugin-content-types/ Content-type plugins
docs/                    Architecture, operations, plans, and references
tests/e2e/               Integrated Playwright user flows
```

## Local Development

Requirements are Node.js, npm, Docker, and Docker Compose.

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run db:migrate:all
npm run db:seed
npm run dev
```

The web app uses `http://localhost:3000`; the API uses `http://localhost:3001`.

Some plugins need additional services:

- Programming Exercises: start the Judge0 services described in [Platform details](docs/reference/PLATFORM_DETAILS.md#run-locally).
- Web Design Coding Exercises: run `npm run dev:runner`.
- Coding Homework Grader challenge generation: configure a supported question-authoring model and run the API worker path documented by that plugin.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

See [Browser user flows](tests/e2e/README.md) for service prerequisites and environment overrides.

## Operations

- [Install on Ubuntu with Apache](docs/DEPLOYMENT_UBUNTU_APACHE.md)
- [Upgrade and rollback](docs/DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md)
- [Release notes template](docs/RELEASE_NOTES_TEMPLATE.md)

Production changes must follow the backup, production-clone migration rehearsal, approval, smoke-test, and rollback gates in those runbooks.

## Documentation Rule

Keep this file navigational. Put detailed behavior in the owning topical document or plugin package, and keep `PROJECT_MEMORY.md` files limited to decisions that future work could easily violate. Update the [documentation index](docs/README.md) whenever a document is added, moved, or changes purpose.
