# Cognelo Agent Instructions

This file intentionally does not duplicate project architecture, conventions, or implementation details. Those belong in the repository documentation and must be read directly.

## Before every new session

Before planning, editing, or running task-specific commands in every newly launched agent session:

1. Read `README.md` completely.
2. Read `docs/PROJECT_MEMORY.md` completely.
3. Read `docs/ARCHITECTURE.md` completely.
4. Inventory the other repository-maintained documentation under `docs/`. Read all platform-wide documents and every implementation plan or memory file relevant to the task; unrelated plugin-specific plans may wait until that plugin is involved.
5. Check `git status --short` and preserve unrelated user changes.

Use `rg --files` to inventory documentation. Exclude third-party, generated, build, and temporary trees such as `.git/`, `node_modules/`, `.next/`, `dist/`, `coverage/`, `tmp/`, and generated Prisma output. If tool output is truncated, continue reading until every required document has been read completely.

Do not use recollection from an earlier session as a substitute for reading the current files.

### Plugin documentation is task-specific

Do not read every plugin's documentation automatically. Before analyzing or changing a task that involves, touches, integrates with, or could affect a plugin:

1. Read that plugin's `README.md` completely.
2. Read that plugin's `PROJECT_MEMORY.md` completely.
3. Read any implementation plan, authoring guide section, migration notes, or other documentation referenced by those files or relevant to the requested behavior.

For example, an MCQ task requires reading the MCQ plugin's `README.md` and `PROJECT_MEMORY.md` before working on it. A cross-plugin or shared-contract change requires reading the documentation for every affected plugin. If a plugin becomes relevant only after investigation begins, pause and read its documentation before continuing.

## Keep documentation current

Documentation is part of the definition of done.

- `README.md` and `PROJECT_MEMORY.md` files must always reflect the current implementation and durable decisions. Never knowingly leave them stale.
- Update the owning plugin's `README.md` and `PROJECT_MEMORY.md` in the same change whenever its behavior, persistence, routes, contracts, operational requirements, integration points, or durable decisions change.
- Update the root `README.md`, `docs/PROJECT_MEMORY.md`, `docs/ARCHITECTURE.md`, and shared authoring documentation when a change affects the platform or establishes a cross-plugin convention.
- Update the relevant implementation plan when a phase is completed or its design changes.
- Keep deployment documentation synchronized with actual scripts, environment variables, migrations, service versions, and infrastructure templates.
- When documentation and implementation disagree, investigate the intended behavior and correct stale documentation in the same change.
- Record durable decisions and non-obvious pitfalls, not a chronological work log.

Before handing off, explicitly review every affected root or plugin `README.md` and `PROJECT_MEMORY.md`, update anything made stale by the change, and state any documentation that could not be verified.
