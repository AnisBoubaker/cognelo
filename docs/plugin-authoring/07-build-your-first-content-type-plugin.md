# Build Your First Content Type Plugin

Back to the [handbook index](README.md)

This tutorial builds a small content type plugin named **Reference link**. It lets a teacher add a title and URL to the course Content tree. The production [Link content plugin](../../packages/plugin-content-types/plugin-link/README.md) implements this use case with HTTP(S)-only validation, descriptions, and configurable browser targets; this tutorial remains a minimal example. The same pattern scales to richer content types such as uploaded files, Markdown notes, repository sync, video providers, or LTI resources.

Content type plugins are not activity plugins. They do not create `Activity`, attempts, submissions, or grades. They own non-activity course content behavior behind generic `CourseContentResource` rows.

## What You Will Build

The plugin will provide:

- picker metadata for a new content type
- server create/update validation
- an open action that points to the saved URL
- a settings form renderer key
- an embedding source descriptor for future indexing

The plugin will not need plugin-owned tables. The safe URL metadata can live in `CourseContentResource.metadata`.

## 1. Create The Package

Create:

```text
packages/plugin-content-types/plugin-reference-link/
  README.md
  PROJECT_MEMORY.md
  package.json
  tsconfig.json
  src/
    index.ts
    server.ts
    settings.tsx
    reference-link.test.ts
```

Use the existing packages as references:

- [packages/plugin-content-types/plugin-github-repo](../../packages/plugin-content-types/plugin-github-repo)
- [packages/plugin-content-types/plugin-file](../../packages/plugin-content-types/plugin-file)
- [packages/plugin-content-types/plugin-text](../../packages/plugin-content-types/plugin-text)

## 2. Define The Content Type

In `src/index.ts`:

```ts
import type { ContentTypePlugin } from "@cognelo/content-type-sdk";

export const referenceLinkContentPlugin: ContentTypePlugin = {
  key: "reference-link-content",
  packageName: "@cognelo/plugin-reference-link",
  name: "Reference link content",
  version: "0.1.0",
  db: {
    namespace: "plugin_reference_link_content",
    tables: [],
    notes: ["Reference links store safe URL metadata in CourseContentResource.metadata."]
  },
  contentTypes: [
    {
      key: "reference-link",
      label: { default: "Reference link" },
      description: { default: "Link to an external reading, video, or documentation page." },
      defaultTitle: { default: "Reference link" },
      icon: "link",
      createMode: "shell",
      embeddingSource: "external_url",
      settingsRendererKey: "reference-link-settings"
    }
  ]
};
```

`key` identifies the plugin installation. `contentTypes[].key` identifies the resource type teachers select in the course picker.

## 3. Add Server Behavior

In `src/server.ts`:

```ts
import { z } from "zod";
import type { ServerContentTypePlugin } from "@cognelo/content-type-sdk/server";

const payloadSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  url: z.string().trim().url().optional()
});

function readUrl(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.url === "string" ? metadata.url : null;
}

export const referenceLinkContentServerPlugin: ServerContentTypePlugin = {
  key: "reference-link-content",
  handlers: {
    async create(input) {
      const parsed = payloadSchema.parse(input.payload);
      return {
        title: parsed.title ?? "Reference link",
        metadata: parsed.url ? { url: parsed.url } : { setupStatus: "draft" }
      };
    },
    async update(input) {
      const parsed = payloadSchema.partial().parse(input.payload);
      return {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        metadata: {
          ...(input.resource.metadata ?? {}),
          ...(parsed.url ? { url: parsed.url } : {})
        }
      };
    },
    async resolveOpenAction(input) {
      const url = readUrl(input.resource.metadata);
      return url ? { kind: "external_url", href: url } : { kind: "none" };
    },
    async getEmbeddingSource(input) {
      const url = readUrl(input.resource.metadata);
      return url ? { kind: "external_url", url, sourceId: input.resource.id } : { kind: "none", sourceId: input.resource.id };
    }
  }
};
```

The embedding hook must return a generic descriptor:

```ts
type ContentEmbeddingSource =
  | { kind: "text"; text: string; sourceId: string }
  | { kind: "file"; fileRef: string; mimeType?: string; sourceId: string }
  | { kind: "external_url"; url: string; sourceId: string }
  | { kind: "none"; sourceId: string };
```

Future indexing code should call core's `getContentResourceEmbeddingSource` service. It should not import your plugin directly.

## 4. Add A Settings Form

In `src/settings.tsx`, export a React component that matches the renderer props used in [apps/web/src/lib/content-type-renderers.tsx](../../apps/web/src/lib/content-type-renderers.tsx). Keep the form plugin-owned, but let the course page own the dialog shell and save button.

Use existing settings forms as models:

- [packages/plugin-content-types/plugin-github-repo/src/settings.tsx](../../packages/plugin-content-types/plugin-github-repo/src/settings.tsx)
- [packages/plugin-content-types/plugin-text/src/settings.tsx](../../packages/plugin-content-types/plugin-text/src/settings.tsx)
- [packages/plugin-content-types/plugin-file/src/settings.tsx](../../packages/plugin-content-types/plugin-file/src/settings.tsx)

The settings form should edit fields that your server `update` handler understands, such as `title` and `url`. The host settings state also provides `metadata` and `onMetadataChange` so the registry adapter can pass plugin-owned fields without adding type-specific host branches.

For resource rows requiring configurable navigation or a description, declare an optional `presentationRendererKey` and register a resolver in `content-type-renderers.tsx`. It returns the SDK `ContentResourcePresentation` (`href`, optional `_blank`/`_self` target, and optional plain-text description). Keep metadata interpretation and URL validation in the plugin; host rows consume only this generic projection. Server `resolveOpenAction` can return the same target hint. The Link plugin shares one validated projection between both paths.

For full-page authoring, declare `editorRendererKey` and register the editor adapter alongside the settings adapter. Declare `rendererKey` for the read-only body renderer. Optional presentation `displayMode` (`inline`, `page`, or `modal`) uses the generic reader shell; page URLs carry the learner's section, and previews carry a return-context flag. See the [Text plugin reference](../../packages/plugin-content-types/plugin-text/docs/REFERENCE.md).

Declare `markdownFields` for top-level metadata fields containing managed image references. Core reconciles those fields transactionally when resources are created, saved, or duplicated; plugins must not activate media themselves or expose private filesystem paths. The generic update accepts optional `isVisible`, validates it, and atomically updates the placement along with authored content. Direct reader APIs require course management or an accessible section and visible resource.

## 5. Register The Plugin

Register the shared definition in:

- [packages/plugin-registry/src/content.ts](../../packages/plugin-registry/src/content.ts)

Register the server plugin in:

- [packages/plugin-registry/src/content-server.ts](../../packages/plugin-registry/src/content-server.ts)

Register the settings renderer in:

- [apps/web/src/lib/content-type-renderers.tsx](../../apps/web/src/lib/content-type-renderers.tsx)

Add TypeScript and Vitest path aliases if the package introduces a new import name.

## 6. Activation And Enablement

After the package is registered, the platform syncs a `ContentTypePluginInstallation` record. Admins manage it at `/settings/plugins` under the **Content type plugins** tab.

Lifecycle behavior:

- newly discovered plugins start inactive and disabled
- activation creates/restores plugin-owned tables if any are declared
- enablement makes the content type selectable for new resources
- disabled but active plugins may still serve existing resources
- inactive/unavailable plugins are blocked at dispatch and render as unavailable in existing content rows

Create/update/duplicate handlers may return an `afterPersist` callback for private records. Core invokes it after the generic resource row is written, inside the same transaction, with the resulting resource ID and neutral tagged-template SQL query/execute methods. Do not perform network or AI work inside this callback, and do not put private fields in public metadata. The Link plugin uses it for private teacher summaries and generation preferences.

## 7. When To Add Plugin-Owned Tables

Use generic `CourseContentResource.metadata` for small, safe, student-visible metadata.

Add plugin-owned tables when you need:

- private provider tokens or sync state
- extraction/indexing job state
- large metadata
- records with their own lifecycle
- audit/event streams
- data that should not be bundled into generic resource payloads

When you add plugin tables, declare them in the plugin `db` manifest and provide plugin-local migrations so activation can create fresh tables or restore backups.

## 8. Verify

Run:

```bash
npm run typecheck
npm test -- packages/plugin-content-types/plugin-reference-link/src/reference-link.test.ts packages/content-type-sdk/src/index.test.ts packages/content-type-sdk/src/server.test.ts packages/core/src/course-content.test.ts
```

Manual checks:

- the plugin appears in `/settings/plugins` under Content type plugins
- after activation and enablement, the content type appears in the course picker
- creating a resource writes a `CourseContentResource`
- the settings form updates the resource
- open action works
- `getEmbeddingSource` returns the expected generic descriptor

Previous: [Checklist And Reference](06-checklist-and-reference.md)
