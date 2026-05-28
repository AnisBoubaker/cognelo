# Build Your First Content Type Plugin

Back to the [handbook index](README.md)

This tutorial builds a small content type plugin named **Reference link**. It lets a teacher add a title and URL to the course Content tree. The same pattern scales to richer content types such as uploaded files, Markdown notes, repository sync, video providers, or LTI resources.

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

The settings form should edit fields that your server `update` handler understands, such as `title` and `url`.

## 5. Register The Plugin

Register the shared definition in:

- [packages/content-type-sdk/src/index.ts](../../packages/content-type-sdk/src/index.ts)

Register the server plugin in:

- [packages/content-type-sdk/src/server.ts](../../packages/content-type-sdk/src/server.ts)

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
