# Content Type Plugin Implementation Plan

This document records the planned migration from core-owned material/content-type behavior to independent content type plugins.
It is intentionally a planning artifact. Implementation should proceed iteratively and update this file whenever contracts, persistence, route dispatch, UI ownership, migration scope, or rollout order changes.

## Goals

- Move concrete non-activity content types out of core/web hardcoded components.
- Store content type plugin packages under `packages/plugin-content-types`.
- Treat content type plugins with the same isolation discipline as activity plugins.
- Keep core references to content type plugins as small and generic as possible.
- Let new content types be added without modifying core business logic, core UI branches, or generic content tree behavior.
- Convert all currently supported material/content types:
  - GitHub repo
  - File
  - Text
- Preserve the unified course content tree as the generic placement, ordering, nesting, and visibility layer.
- Keep activity plugins separate from content type plugins.
- Prepare content type plugins for future semantic indexing/embedding workflows.
- Update the plugin-authoring guide to cover content type plugins at the same level of detail as activity plugins.

## Hard Requirements

Content type plugins must be as independent from core as activity plugins.

Core must not:

- branch on concrete content type keys such as `file`, `github_repo`, or `text`
- own content-type-specific validation rules
- own content-type-specific settings forms
- own content-type-specific rendering/opening/downloading behavior
- own content-type-specific route handlers beyond generic dispatch
- import content type plugin packages directly from core service modules
- know content-type-specific storage schemas beyond generic references

Core may own:

- course authorization
- generic course content tree placement/order/visibility
- generic content item/resource identity
- generic plugin installation and enablement checks
- generic dispatch to a registered content type plugin
- generic audit-compatible metadata such as plugin key/type key/version

The web app may own generic shells:

- course content tree rows
- picker containers
- settings overlays/dialog frames
- generic route links
- generic error/loading states

The web app must not own content-type-specific forms or business rules once the migration is complete.

## Current State

The unified course content tree is implemented with `CourseContentItem`.

Folders are generic course-level structure and should remain core content tree items. Folders are not material/content type plugins.

Current non-activity content types are represented as material kinds and a lightweight web registry:

- `github_repo`
- `file`
- `text`

Current implementation details that must move behind content type plugins include:

- picker labels/descriptions/icons/default titles
- create behavior
- settings/edit UI
- validation rules, such as GitHub URL validation
- upload/download/open behavior for files
- text editing/rendering behavior
- embedding source hints
- any future content-specific API routes

At this stage all application data is expendable. Do not spend implementation effort preserving current dev/test records beyond the minimal Prisma schema migrations needed to keep the database structure valid. Instead, update the seed data used for testing and re-seed.

## Target Vocabulary

Use "content type plugin" for non-activity course content types.

Use "activity plugin" only for attempted/assigned/gradable activity behavior.

Use "content item" for the generic course tree node.

Use "content resource" or "content instance" for the plugin-backed concrete record referenced by a content tree item. The exact database table name should be decided during schema design.

Avoid calling content type plugins "materials" in new architecture docs except when describing legacy compatibility. Materials were the older product term for non-activity resources.

## Target Package Layout

Add a new package family:

```text
packages/
  content-type-sdk/
    src/
      index.ts
      server.ts
  plugin-content-types/
    plugin-file/
    plugin-github-repo/
    plugin-text/
```

Rationale:

- `packages/plugin-activities` remains dedicated to activity plugins.
- `packages/plugin-content-types` becomes the home for content type plugin packages.
- `packages/content-type-sdk` keeps content plugin contracts and registries separate from `activity-sdk`.
- Web/app/core code can depend on SDK contracts without importing concrete plugin packages except at explicit registry wiring points.

The root workspace list should include:

```json
"packages/content-type-sdk",
"packages/plugin-content-types/*"
```

## Target Plugin Contracts

The contract names below are provisional and should be validated during implementation.

### `ContentTypePlugin`

Frontend/shared definition registry:

```ts
type ContentTypePlugin = {
  key: string;
  name: string;
  description?: string;
  types: ContentTypeDefinition[];
};

type ContentTypeDefinition = {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  icon: ContentTypeIconName;
  defaultTitle: LocalizedText;
  createMode: "shell" | "upload" | "custom";
  embeddingSource: "external_url" | "file_upload" | "text_body" | "none" | "custom";
  rendererKey?: string;
  settingsRendererKey?: string;
};
```

### `ServerContentTypePlugin`

Server definition and behavior registry:

```ts
type ServerContentTypePlugin = {
  key: string;
  types: ServerContentTypeDefinition[];
  db?: PluginDatabaseManifest;
  routes?: ContentTypeRouteDefinition[];
  handlers?: {
    create?: ContentTypeCreateHandler;
    update?: ContentTypeUpdateHandler;
    delete?: ContentTypeDeleteHandler;
    resolveOpenAction?: ContentTypeOpenActionHandler;
    getEmbeddingSource?: ContentTypeEmbeddingSourceHandler;
  };
};
```

Server handlers should receive generic course/user/context input from core, perform plugin-owned validation/business logic, and return generic resource references and safe metadata.

### Web Renderers

Add a web registry similar to `activity-renderers.tsx`, for example:

```text
apps/web/src/lib/content-type-renderers.tsx
```

It should map renderer keys from content type definitions to plugin-exported React components.

Candidate renderer roles:

- picker card icon/body
- content row badge/icon, if custom beyond a shared icon name
- settings editor
- inline viewer or preview
- student open/locked presentation

The generic course/group pages should ask the registry for renderers and should not import concrete content type plugins directly.

## Target Database Model

The exact schema should be designed in Phase 2, but the direction should remove concrete material type semantics from core.

Recommended direction:

### Generic Content Resource Table

Replace or progressively wrap `CourseMaterial` with a generic plugin-backed table such as:

```prisma
model CourseContentResource {
  id             String   @id @default(cuid())
  courseId       String
  groupId        String?
  contentTypeKey String
  pluginKey      String
  title          String
  metadata       Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

`CourseContentItem(kind: "material")` is migrated immediately to:

```text
CourseContentItem(kind: "content")
```

Legacy `materialId` may remain temporarily during compatibility, but new generic resource-backed content uses `contentResourceId`.

The preferred end state is:

```prisma
model CourseContentItem {
  id                String
  courseId          String
  groupId           String?
  parentId          String?
  kind              CourseContentItemKind // folder | content | activity
  contentResourceId String?
  activityId        String?
  courseGroupActivityId String?
  titleSnapshot     String?
  position          Int
  isVisible         Boolean
  metadata          Json
}
```

Compatibility may require keeping `materialId` until all callers have moved.

### Plugin-Owned Tables

Content type plugins may own private tables when generic metadata is not enough.

Examples:

- File plugin may own upload records, stored file names, checksums, MIME type, size, and future extraction/indexing state.
- Text plugin may own text body revisions or rendered/normalized variants.
- GitHub repo plugin may own URL normalization, branch/path metadata, sync status, or repository indexing state.

Plugin-owned tables must follow the same migration/backup/activation discipline as activity plugin tables.

## API Surface

Core/API should expose generic content resource dispatch routes, not one route per content type.

Potential generic routes:

```text
GET    /api/courses/:courseId/content-types
POST   /api/courses/:courseId/content-resources
PATCH  /api/courses/:courseId/content-resources/:resourceId
DELETE /api/courses/:courseId/content-resources/:resourceId

POST   /api/courses/:courseId/content-types/:contentTypeKey/[...pluginPath]
GET    /api/courses/:courseId/content-resources/:resourceId/[...pluginPath]
POST   /api/courses/:courseId/content-resources/:resourceId/[...pluginPath]
```

Group-scoped variants should exist where group-specific resources are allowed:

```text
POST   /api/courses/:courseId/groups/:groupId/content-resources
PATCH  /api/courses/:courseId/groups/:groupId/content-resources/:resourceId
DELETE /api/courses/:courseId/groups/:groupId/content-resources/:resourceId
```

The generic create route should:

- authorize the teacher
- verify the content type plugin is active/enabled
- dispatch validation/creation to the server content type plugin
- create the generic resource row
- create the generic `CourseContentItem` placement row
- return safe generic data plus plugin-provided safe metadata

The generic student routes should:

- rely on effective content visibility from the content tree
- never expose hidden content resources
- delegate content-specific open/download/view behavior through a safe plugin route or plugin-provided open action

## Plugin Installation And Enablement

Content type plugins should have their own installation records, parallel to activity plugins.

Candidate model:

```prisma
model ContentTypePluginInstallation {
  key         String @id
  name        String
  version     String
  isActivated Boolean
  isEnabled   Boolean
  metadata    Json
  createdAt   DateTime
  updatedAt   DateTime
}
```

Open decision: decide whether admin settings should show activity plugins and content type plugins on:

- one shared "Plugins" settings page with separate sections, or
- separate "Activity plugins" and "Content type plugins" pages.

The enablement behavior should mirror activity plugins:

- discovered plugins start inactive and disabled
- activation syncs definitions and validates/creates plugin-owned tables
- enablement controls whether teachers can create new content of that type
- existing content should remain readable if a plugin is disabled but active, unless the plugin is unavailable
- deactivation backs up plugin-owned tables where applicable

## Conversion Scope For Existing Content Types

### GitHub Repo Content Type Plugin

Package:

```text
packages/plugin-content-types/plugin-github-repo
```

Owned behavior:

- picker definition and icon
- title and repository URL settings form
- URL validation and normalization
- open action
- safe display metadata
- embedding source descriptor for the repo URL and, later, synced repository contents

Initial persistence can use generic metadata:

```json
{
  "url": "https://github.com/org/repo"
}
```

Future plugin-owned tables may store repository sync/indexing state.

### File Content Type Plugin

Package:

```text
packages/plugin-content-types/plugin-file
```

Owned behavior:

- picker definition and icon
- title and upload settings form
- upload validation
- file storage metadata
- download/open route
- safe display metadata such as original filename and file size
- embedding source descriptor for uploaded file extraction

Recommended initial plugin-owned table:

```prisma
model FileContentResource {
  id                String @id @default(cuid())
  contentResourceId String @unique
  originalName      String
  storedName        String
  mimeType          String?
  sizeBytes         Int
  checksum          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

The generic content resource metadata may duplicate safe display values for list performance, but the plugin owns the source of truth for file storage details.

### Text Content Type Plugin

Package:

```text
packages/plugin-content-types/plugin-text
```

Owned behavior:

- picker definition and icon
- title and text editor settings form
- text validation/sanitization policy
- display renderer
- embedding source descriptor for text body

Recommended initial plugin-owned table:

```prisma
model TextContentResource {
  id                String @id @default(cuid())
  contentResourceId String @unique
  body              String
  format            String // markdown initially, if desired
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

Open decision: decide whether text content should be Markdown-only initially or support a richer editor contract.

## Implementation Phases

### Current Status

- Phase 1 is implemented.
- Phase 2 is implemented.
- Phase 3 is implemented.
- Phase 4 is implemented.
- Phase 5 is implemented.
- Activity plugins have been moved under `packages/plugin-activities`.
- Course content tree is canonical for placement/order/visibility.
- Concrete non-activity content types are still hardcoded as material kinds and a web-only material type registry.
- `packages/content-type-sdk` now provides initial shared/server content type plugin contracts and empty registries.
- `packages/plugin-content-types` exists as the future home for concrete content type plugin packages.
- Core Prisma now has `CourseContentResource` and `ContentTypePluginInstallation`.
- `CourseContentItemKind` now uses `content` instead of `material`; legacy `materialId` remains only as a compatibility bridge until later phases migrate callers and seed data fully.

### Phase 1: Package Layout And SDK Contracts - Complete

- Add `packages/content-type-sdk`.
- Add `packages/plugin-content-types`.
- Add workspace globs and TypeScript path aliases.
- Define shared content type plugin contracts.
- Add client/shared content type registry functions:
  - list content type plugins
  - list content type definitions
  - resolve plugin by key
  - resolve content type by key
- Add server registry functions parallel to activity server plugin registry.
- Add focused SDK tests.

Verification:

- `npm run typecheck`
- content type SDK tests

Implemented scope: added `@cognelo/content-type-sdk` with shared content type plugin contracts, localized message helpers, plugin/type manifest listing, duplicate plugin/type guards, server content type plugin contracts, generic route definitions, server route listing, and route resolution. The root workspace and TypeScript aliases now include the new SDK and the future `packages/plugin-content-types/*` workspace family. No concrete content type plugins are registered yet; GitHub repo, File, and Text conversion remains for later phases.

### Phase 2: Generic Persistence Model - Complete

- Design and add generic `CourseContentResource` or equivalent.
- Add `ContentTypePluginInstallation` or equivalent.
- Change `CourseContentItem.kind` from `material` to `content` immediately.
- Add migrations and schema tests.
- Keep old `CourseMaterial`/`MaterialKind` compatibility until callers are migrated.
- Add core service helpers that operate only on generic resource/plugin keys.

Core service helpers may:

- create generic resources after plugin validation
- update generic title/safe metadata after plugin update
- delete generic resources through plugin hooks
- list resources with safe metadata

Core service helpers must not branch by concrete content type.

Verification:

- Prisma validation
- migration tests
- core persistence tests
- `npm run typecheck`

Implemented scope: added `CourseContentResource` as the generic plugin-backed content resource table and `ContentTypePluginInstallation` for future content type plugin lifecycle state. `CourseContentItemKind` now has `folder`, `content`, and `activity`; the migration maps old `material` content items to `content`. `CourseContentItem` now supports `contentResourceId` while keeping legacy `materialId` compatibility. Core content services now expose generic content resource create/update/list/delete helpers plus a generic resource-backed content item helper, without branching on concrete content type keys. Legacy material-backed content item creation remains temporarily but now writes `kind: "content"`.

Verification completed after Phase 2:

- `npx prisma validate --schema packages/db/prisma/schema.prisma`
- `npm run db:generate --workspace @cognelo/db`
- `npm test -- packages/db/prisma/course-content-schema.test.ts packages/core/src/course-content.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts`
- `npm run typecheck`

### Phase 3: Server Dispatch And Enablement - Complete

- Add content type plugin installation sync.
- Add activation/enablement service functions parallel to activity plugin services.
- Add generic content resource API routes.
- Add generic plugin dispatch routes for content resources.
- Add authorization checks consistent with course content APIs.
- Add tests for:
  - disabled plugin cannot create new content
  - active plugin can serve existing content routes
  - student cannot access hidden content through plugin routes
  - unauthorized users are blocked before plugin dispatch
  - core never imports concrete content type plugin packages outside registry wiring

Verification:

- API route tests
- core plugin enablement tests
- `npm run typecheck`
- `npm test`

Implemented scope: content type plugin installations now sync from the content type SDK registry and support admin-only activation, enablement, deactivation, plugin-owned table creation, and backup/restore behavior parallel to activity plugins. Generic content resource APIs now create, update, delete, list, and dispatch plugin-backed resources for course and group scopes. Creation requires the owning content type plugin to be active and enabled; existing resource plugin routes require the resource plugin to remain active. Non-manager plugin route access goes through the course content tree visibility gate before dispatch, so hidden resources cannot be reached through plugin routes. The content type listing route returns only enabled content type definitions.

Verification completed after Phase 3:

- `npm run typecheck`
- `npm test -- packages/core/src/plugins.test.ts packages/core/src/course-content.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts 'apps/api/src/app/api/content-type-plugins/route.test.ts' 'apps/api/src/app/api/content-type-plugins/[pluginKey]/route.test.ts' 'apps/api/src/app/api/courses/[courseId]/content-resources/route.test.ts' 'apps/api/src/app/api/courses/[courseId]/content-resources/[resourceId]/[...pluginPath]/route.test.ts'`

### Phase 4: Web Registry And Generic UI Shell - Complete

- Add `apps/web/src/lib/content-type-renderers.tsx`.
- Replace `apps/web/src/lib/material-types.ts` with SDK-backed content type definitions or make it a temporary compatibility adapter.
- Update the course element picker Material category to read content type definitions from the content type registry.
- Update content tree row icon/badge/settings resolution through the renderer registry.
- Keep the generic course/group pages responsible only for tree placement, generic actions, dialog shells, and dispatching to renderer components.
- Add i18n strategy for content type plugin labels:
  - plugin exports localized labels directly, or
  - plugin exports label keys and locale bundles.

Verification:

- web typecheck
- i18n/registry tests
- smoke test course and group content pages

Implemented scope: added `apps/web/src/lib/content-type-renderers.tsx` as the generic web content type renderer registry surface, with renderer/settings renderer resolution and a shared `ContentTypeIcon` primitive. The existing `apps/web/src/lib/material-types.ts` is now an explicit temporary compatibility adapter: it exposes the current GitHub repo, File, and Text material picker entries as SDK-shaped `ContentTypeDefinition` records while retaining legacy material kind keys and i18n keys until Phases 5-7 move those concrete types into plugin packages. Course and group content pages now use the shared content type icon primitive instead of duplicating material icon rendering. The web API client now knows about generic content type definitions, content resources, resource creation, and `contentResourceId` on content items, preparing the UI shell for plugin-backed content resources without switching existing material creation flows prematurely.

Verification completed after Phase 4:

- `npm run typecheck`
- `npm test -- apps/web/src/lib/content-type-renderers.test.ts apps/web/src/lib/material-types.test.ts apps/web/src/lib/api.test.ts`
- `npm test`

### Phase 5: Convert GitHub Repo Plugin - Complete

- Create `packages/plugin-content-types/plugin-github-repo`.
- Move GitHub repo picker metadata into the plugin.
- Move GitHub repo settings UI into the plugin.
- Move GitHub URL validation/normalization into plugin server code.
- Move open action resolution into plugin code.
- Add tests for valid/invalid URLs and renderer wiring.
- Migrate existing `CourseMaterial(kind: "github_repo")` seed/data to generic content resources.

Verification:

- plugin tests
- API create/update tests
- web settings renderer tests where feasible
- `npm test`

Implemented scope: added `packages/plugin-content-types/plugin-github-repo` with the `github-repo-content` plugin and `github-repo` content type. The plugin owns picker metadata, localized labels, default title, GitHub icon selection, URL normalization/validation, generic create/update handlers, open-action resolution, and embedding source resolution. It currently uses generic `CourseContentResource.metadata` for `{ url }` and declares no plugin-owned tables. The content type SDK and server registry now explicitly wire this plugin. The web content type renderer registry resolves the plugin settings renderer key to the plugin-owned GitHub settings form, while the course page owns only the dialog shell/state plumbing. The course picker now prefers the enabled GitHub repo content type plugin and falls back to legacy material definitions for File/Text until their conversion phases. Course and group content resource listings can open visible plugin-backed GitHub repo resources, and non-manager resource listing is filtered by effective content-tree visibility. Seed data activates/enables registered content type plugins and migrates the sample GitHub repo tree item to a generic `CourseContentResource`.

Verification completed after Phase 5:

- `npm run typecheck`
- `npm test -- packages/plugin-content-types/plugin-github-repo/src/github-repo.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts packages/core/src/course-content.test.ts packages/core/src/plugins.test.ts apps/web/src/lib/material-types.test.ts apps/web/src/lib/content-type-renderers.test.ts`
- `npm test`

### Phase 6: Convert File Plugin

- Create `packages/plugin-content-types/plugin-file`.
- Move file picker metadata into the plugin.
- Move upload settings UI into the plugin.
- Move file metadata, upload validation, and download route handling into plugin server code.
- Add plugin-owned persistence if generic metadata is not enough.
- Ensure student download routes enforce content tree visibility before plugin dispatch.
- Migrate existing `CourseMaterial(kind: "file")` seed/data to generic content resources.

Verification:

- upload/create/update/download tests
- hidden content access tests
- plugin DB migration tests if plugin-owned tables are added
- `npm test`

Implemented scope: added `packages/plugin-content-types/plugin-file` with the `file-content` plugin and `file` content type. The plugin owns File picker metadata, localized labels, default title, upload-oriented create mode, file settings form, server-side draft create/update handling, multipart upload route, download route, and embedding source descriptor generation. Uploaded files are stored in local `storage/course-content-files/:courseId` for the current MVP/dev storage model and the plugin records safe file metadata in generic `CourseContentResource.metadata`; no plugin-owned tables were needed yet. The content type SDK, server registry, TypeScript aliases, Vitest aliases, and package dependencies now wire the plugin. The course picker now shows enabled plugin-backed File resources instead of falling back to the legacy material picker, course settings upload through the plugin route, and course/group content rows use plugin-backed file download URLs with section-scoped visibility enforcement for group access. Seed data now creates representative File resources as `CourseContentResource` rows and points the content tree at those resources.

Verification completed after Phase 6:

- `npm run typecheck`
- `npm test -- packages/plugin-content-types/plugin-file/src/file-content.test.ts packages/plugin-content-types/plugin-text/src/text-content.test.ts packages/plugin-content-types/plugin-github-repo/src/github-repo.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts apps/web/src/lib/content-type-renderers.test.ts apps/web/src/lib/material-types.test.ts packages/core/src/course-content.test.ts`
- `npm test`

### Phase 7: Convert Text Plugin

- Create `packages/plugin-content-types/plugin-text`.
- Move text picker metadata into the plugin.
- Move text settings editor into the plugin.
- Move text display/sanitization/rendering policy into the plugin.
- Add plugin-owned persistence for text bodies if needed.
- Migrate existing `CourseMaterial(kind: "text")` seed/data to generic content resources.

Verification:

- text editor/settings tests where existing patterns support it
- rendering/sanitization tests
- API create/update tests
- `npm test`

Implemented scope: added `packages/plugin-content-types/plugin-text` with the `text-content` plugin and `text` content type. The plugin owns Text picker metadata, localized labels, default title, shell create mode, text settings editor, server create/update behavior, viewer/open-action declaration, and text embedding source extraction from generic metadata. Text content currently stores Markdown body data in `CourseContentResource.metadata` with `format: "markdown"`; no plugin-owned tables were needed for the current phase. The content type SDK, server registry, web renderer registry, TypeScript aliases, Vitest aliases, and package dependencies now wire the plugin. The course picker now creates plugin-backed Text resources, the course settings dialog renders the plugin-owned text editor, and seed data now creates representative Text resources as `CourseContentResource` rows and points the content tree at those resources.

Verification completed after Phase 7:

- `npm run typecheck`
- `npm test -- packages/plugin-content-types/plugin-file/src/file-content.test.ts packages/plugin-content-types/plugin-text/src/text-content.test.ts packages/plugin-content-types/plugin-github-repo/src/github-repo.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts apps/web/src/lib/content-type-renderers.test.ts apps/web/src/lib/material-types.test.ts packages/core/src/course-content.test.ts`
- `npm test`

### Phase 8: Remove Core/Web Material Type Branching

- Remove concrete `github_repo` / `file` / `text` branches from course and group pages.
- Remove or replace `apps/web/src/lib/material-types.ts`.
- Remove concrete `MaterialKind` dependency from picker and tree UI.
- Remove content-type-specific API helpers from `apps/web/src/lib/api.ts`, replacing them with generic content resource/plugin route helpers.
- Keep compatibility aliases only where needed for data migration, not for new behavior.
- Add a no-hardcoded-content-types test or lint-style guard where practical.

Verification:

- `rg` checks for hardcoded content type branches outside plugins and tests
- `npm run typecheck`
- `npm test`

Implemented scope: removed the legacy web material type adapter (`apps/web/src/lib/material-types.ts`) and its tests. The course picker now creates only plugin-backed content resources from enabled content type definitions; it no longer falls back to hardcoded File/Text/GitHub material definitions. Course and group content pages no longer branch on concrete File/Text/GitHub content type keys; they use generic content type definition metadata such as `embeddingSource` and the renderer registry for plugin-backed behavior. The old group Materials tab was removed so the unified Content tab remains the canonical management surface. Web API client methods that created or updated concrete material types were removed; only compatibility download/delete helpers remain for older material-backed content items. Added `apps/web/src/lib/content-type-boundaries.test.ts` to guard course page code against reintroducing concrete content type key branches.

Verification completed after Phase 8:

- `rg` checks for concrete content type branches in course/group pages
- `npm run typecheck`
- `npm test -- apps/web/src/lib/content-type-boundaries.test.ts apps/web/src/lib/content-type-renderers.test.ts packages/core/src/course-content.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts`
- `npm test`

### Phase 9: Seed Update And Legacy Cleanup

- Update seed data to create content resources through plugin-aware helpers.
- Replace dev/test material records by re-seeding plugin-backed content resources.
- Decide whether to drop or leave legacy `CourseMaterial` tables/fields.
- If dropping legacy tables is premature, mark them compatibility-only in docs and memory.
- Ensure seeded course still covers:
  - GitHub repo
  - File
  - Text
  - visible folders
  - hidden folders
  - mixed activities and content resources

Verification:

- `npm run db:seed`
- content tree API tests
- representative app smoke checks

Implemented scope: seed data now creates representative GitHub repo, File, and Text resources as plugin-backed `CourseContentResource` rows and points the sample content tree at those resources. The old seed material rows are deleted during seeding instead of being recreated. Legacy `CourseMaterial`, `CourseGroupMaterial`, and material-backed `CourseContentItem.materialId` fields remain in the schema and API as compatibility-only surfaces for older local records and downloads; dropping them is deferred until all legacy route tests and old-record compatibility needs are retired.

Verification completed after Phase 9:

- `npm run db:seed`
- course content/resource API smoke checks against `seed-course-programming-101`
- `npm run typecheck`
- `npm test`

### Phase 10: Plugin Admin UI

Implemented.

- Reused the existing `/settings/plugins` admin page rather than adding a second settings route.
- The page now has distinct Activity plugins and Content type plugins sections.
- Both sections support the same lifecycle controls:
  - activate discovered plugins
  - restore matching plugin table backups where available
  - enable/disable active plugins
  - deactivate only after disabling
- Content type plugin admin actions call the generic `/api/content-type-plugins` settings API.
- The course content type endpoint now returns:
  - `contentTypes`: enabled definitions that may be selected for new resource creation
  - `activeContentTypes`: active definitions that may still render/open existing resources
- The course and group content trees use enabled content type definitions for the picker, and active definitions for existing resource rows.
- Existing content resources whose plugin is inactive or unavailable now render with a `Plugin unavailable` badge and no open/download action.

Verification:

- `npm run typecheck`
- focused plugin/content tests:
  - `packages/core/src/plugins.test.ts`
  - `apps/api/src/app/api/plugins/route.test.ts`
  - `apps/api/src/app/api/plugins/[pluginKey]/route.test.ts`
  - `apps/api/src/app/api/content-type-plugins/route.test.ts`
  - `apps/api/src/app/api/content-type-plugins/[pluginKey]/route.test.ts`
- manual settings UI smoke with the running dev server
- `npm test`

### Phase 11: Embedding/Indexing Readiness

Implemented.

- The server content type SDK exposes the plugin-owned `getEmbeddingSource` contract.
- The contract returns the generic descriptor union below and no plugin-specific internals:

```ts
type ContentEmbeddingSource =
  | { kind: "text"; text: string; sourceId: string }
  | { kind: "file"; fileRef: string; mimeType?: string; sourceId: string }
  | { kind: "external_url"; url: string; sourceId: string }
  | { kind: "none"; sourceId: string };
```

- Core now exposes `getContentResourceEmbeddingSource`, which resolves the resource, applies plugin active/authorization/visibility checks, and dispatches to the owning server content type plugin.
- GitHub repo, File, and Text content plugins return external URL, file, and text descriptors respectively.
- No embeddings database or semantic index was added in this phase.
- Future activity generation should ask a generic content indexing service, backed by this core service, rather than importing concrete content type plugins directly.

Verification:

- contract tests:
  - `packages/content-type-sdk/src/server.test.ts`
  - `packages/core/src/course-content.test.ts`
- plugin handler tests for GitHub/File/Text embedding descriptors:
  - `packages/plugin-content-types/plugin-github-repo/src/github-repo.test.ts`
  - `packages/plugin-content-types/plugin-file/src/file-content.test.ts`
  - `packages/plugin-content-types/plugin-text/src/text-content.test.ts`

### Phase 12: Documentation And Authoring Guide

Implemented.

Updated platform docs:

- `README.md`
- `docs/PROJECT_MEMORY.md`
- `docs/ARCHITECTURE.md`

Updated plugin authoring guide at the same level of prior knowledge as the activity plugin guide:

- `docs/plugin-authoring/README.md` now explains that Cognelo has activity plugins and content type plugins.
- `docs/plugin-authoring/00-quick-reference.md` now includes a fast path, contract reference, route example, renderer registration, persistence guidance, activation guidance, and embedding descriptor guidance for content type plugins.
- `docs/plugin-authoring/06-checklist-and-reference.md` now includes content type plugin checklist and reference links.
- Added `docs/plugin-authoring/07-build-your-first-content-type-plugin.md`, a complete beginner tutorial for a simple Reference link content type plugin.
- Added or expanded beginner sections explaining:
  - what content type plugins are
  - how they differ from activity plugins
  - where packages live
  - what contracts they implement
  - how server dispatch works
  - how web renderers/settings forms are registered
  - when plugin-owned Prisma tables are needed
  - how activation/enablement works
  - how embedding source hooks should be implemented
- Updated checklist/reference links to include:
  - `plugin-github-repo`
  - `plugin-file`
  - `plugin-text`

The guide should be approachable for someone who knows Next.js basics but is new to Cognelo plugin architecture, matching the current activity plugin authoring handbook style.

Verification:

- docs link/path scan
- `rg` check for stale `packages/plugins` paths
- `npm run typecheck`

## Testing Plan

SDK tests should cover:

- registry listing
- plugin/type lookup
- duplicate plugin key rejection
- duplicate content type key rejection
- server registry route lookup

Core tests should cover:

- content resource creation through generic plugin key/type key
- plugin enablement checks
- generic resource deletion hooks
- no concrete content type branching in core services
- effective visibility still inherited through content tree folders

API tests should cover:

- teacher can create/update/delete a plugin-backed content resource
- student can open visible content through plugin dispatch
- hidden content cannot be opened through plugin dispatch
- disabled plugin cannot create new resources
- unavailable plugin produces a safe error for existing resources
- unauthorized users are blocked before plugin dispatch

Plugin tests should cover:

- GitHub URL validation and open action
- File upload metadata and download route
- Text create/update/rendering behavior
- embedding source descriptor for each converted content type

Frontend tests should cover where patterns exist:

- picker renders content type plugin definitions
- generic content settings overlay resolves plugin settings renderer
- content rows resolve plugin icons/labels without hardcoded type branches
- i18n or plugin-local localized labels

Migration/seed tests should cover:

- seeded GitHub/File/Text content is created as plugin-backed content resources
- content tree placement/order/visibility is preserved
- seeded course still exercises mixed folders, activities, and content resources

## Documentation Updates

Because this is a platform-level architecture change, update:

- `README.md`
- `docs/PROJECT_MEMORY.md`
- `docs/ARCHITECTURE.md`
- `docs/plugin-authoring/*`

Document:

- `packages/plugin-content-types` as the home for content type plugins
- `packages/plugin-activities` as the home for activity plugins
- content type plugins as separate from activity plugins
- folders remaining generic core content tree items
- content tree placement/order/visibility remaining generic core behavior
- content type business logic, settings UI, routes, validation, storage, and embedding-source extraction moving into plugins
- concrete GitHub/File/Text conversions
- activation/enablement expectations
- plugin-owned persistence and migration expectations

## Open Decisions

- Should the generic table be named `CourseContentResource`, `CourseResource`, or something else?
- Should `CourseMaterial` be migrated away immediately or retained as a compatibility table for one release?
- Should content type plugin install records share infrastructure with activity plugin install records or use separate tables/services?
- Should plugin activation/admin UI be one page with sections or separate activity/content plugin pages?
- Should content type labels be exported as localized strings or locale keys plus plugin locale bundles?
- Should file storage remain local for MVP or move behind a storage adapter as part of the file plugin conversion?
- Should text content be Markdown-only initially?
- How should unavailable content type plugins render existing content rows?
