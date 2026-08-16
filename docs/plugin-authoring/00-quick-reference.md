# Plugin Authoring Quick Reference

Back to the [handbook index](README.md)

This page is the short version for experienced Next.js developers who want the Cognelo-specific integration points without the tutorial pacing.

Use this when you already understand:

- React
- Next.js apps and route handlers
- TypeScript package boundaries
- Prisma
- Zod

If you want the slower, beginner-friendly path, start at [Cognelo And Next.js Basics](01-basics.md).

## Mental Model

Cognelo has:

- `apps/web`: frontend app
- `apps/api`: backend API app
- `packages/activity-sdk`: plugin registration and plugin contracts
- `packages/activity-ui`: shared code editor/renderer/markdown/notifications
- `packages/content-type-sdk`: content type plugin registration and contracts
- `packages/core`: shared business logic
- `packages/contracts`: shared schemas/types
- `packages/db`: Prisma schema, migrations, seed
- `packages/plugin-activities/*`: plugin packages
- `packages/plugin-content-types/*`: content type plugin packages

Activity plugins own activity-specific behavior. Content type plugins own non-activity course content behavior. The platform owns generic auth, subject/activity-bank/course/activity CRUD, content tree placement, resource rows, route dispatch, activity copying, and shared UI primitives.

For authored rich text display, use `MarkdownRenderer` from `@cognelo/activity-ui`. For transient confirmations and non-field-specific errors, use `useNotifications()` instead of adding a plugin-local inline “saved” banner.

For every plugin authoring or settings form, use `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Keep a saved snapshot, compute `isDirty`, and provide `onSave` plus `onDiscard` so shared navigation can offer continue editing, save and leave, or discard and leave.

If a plugin adds AI-assisted generation that writes into authoring/configuration fields, confirm before replacing any non-empty existing content. Treat generation as a destructive overwrite unless it appends into a clearly separate draft area.

## Minimal Activity Plugin Flow

1. Create `packages/plugin-activities/plugin-your-plugin`
2. Export an `ActivityPlugin`
3. Register it in `packages/activity-sdk/src/index.ts`
4. If needed, export a `ServerActivityPlugin`
5. Register it in `packages/activity-sdk/src/server.ts`
6. If needed, export a React renderer
7. Register it in `apps/web/src/lib/activity-renderers.tsx`
8. If needed, add plugin tables in `packages/db/prisma/schema.prisma`
9. If the plugin exposes any authoring or settings form, register unsaved-change behavior with `useUnsavedChangesGuard`
10. If the plugin stores private bank-owned data, add a server hook to copy it into course-owned plugin tables when a bank version is assigned to a course. This is mandatory; core does not know how to copy plugin-owned rows.
11. If needed, add browser API helpers in `apps/web/src/lib/api.ts`

## Minimal Content Type Plugin Flow

1. Create `packages/plugin-content-types/plugin-your-content-type`
2. Export a `ContentTypePlugin`
3. Register it in `packages/content-type-sdk/src/index.ts`
4. Export a `ServerContentTypePlugin`
5. Register it in `packages/content-type-sdk/src/server.ts`
6. Add settings/viewer components if needed
7. Register settings/viewer renderers in `apps/web/src/lib/content-type-renderers.tsx`
8. If needed, add plugin routes for upload/download/viewer behavior
9. Implement `getEmbeddingSource`
10. Add plugin-owned tables only when generic `CourseContentResource.metadata` is insufficient

Content type plugins do not create `Activity`, `BankActivity`, attempts, or gradebook rows. They create and manage `CourseContentResource` behavior. Folders stay generic `CourseContentItem` rows owned by core.

## Required Registration Points

### Activity definition registry

File:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)

What you add:

```ts
import { yourPlugin } from "@cognelo/plugin-your-plugin";

const plugins: ActivityPlugin[] = [
  placeholderPlugin,
  codingHomeworkGraderPlugin,
  parsonsPlugin,
  yourPlugin
];
```

### Server route registry

File:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

What you add:

```ts
import { yourServerPlugin } from "@cognelo/plugin-your-plugin/server";

const serverPlugins: readonly ServerActivityPlugin[] = [
  placeholderServerPlugin,
  codingHomeworkGraderServerPlugin,
  parsonsServerPlugin,
  yourServerPlugin
];
```

### Frontend renderer registry

File:

- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)

What you add:

```ts
import { YourActivityView } from "@cognelo/plugin-your-plugin";

export const activityRenderers = {
  "parsons-problem": ParsonsActivityRenderer,
  "your-activity-type": YourActivityView
} as const;
```

### Content type definition registry

File:

- [packages/content-type-sdk/src/index.ts](../../packages/content-type-sdk/src/index.ts)

What you add:

```ts
import { yourContentPlugin } from "@cognelo/plugin-your-content-type";

const plugins: ContentTypePlugin[] = [
  githubRepoContentPlugin,
  fileContentPlugin,
  textContentPlugin,
  yourContentPlugin
];
```

### Content type server registry

File:

- [packages/content-type-sdk/src/server.ts](../../packages/content-type-sdk/src/server.ts)

What you add:

```ts
import { yourContentServerPlugin } from "@cognelo/plugin-your-content-type/server";

const serverPlugins: readonly ServerContentTypePlugin[] = [
  githubRepoContentServerPlugin,
  fileContentServerPlugin,
  textContentServerPlugin,
  yourContentServerPlugin
];
```

### Content type renderer registry

File:

- [apps/web/src/lib/content-type-renderers.tsx](../../apps/web/src/lib/content-type-renderers.tsx)

What you add:

```ts
import { YourContentSettings } from "@cognelo/plugin-your-content-type/settings";

const contentTypeSettingsRenderers = {
  "your-content-settings": YourContentSettings
};
```

## Recommended Package Shape

```text
packages/plugin-activities/plugin-your-plugin/
  README.md
  PROJECT_MEMORY.md
  package.json
  tsconfig.json
  src/
    index.ts
    plugin.ts
    server.ts
    routes.ts
    db.ts
    web/
      your-activity-view.tsx
```

Content type plugin package:

```text
packages/plugin-content-types/plugin-your-content-type/
  README.md
  PROJECT_MEMORY.md
  package.json
  tsconfig.json
  src/
    index.ts
    server.ts
    settings.tsx
    db.ts
    your-content-type.test.ts
```

## Core Contracts You Plug Into

### `ActivityPlugin`

Defined in:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)

Typical shape:

```ts
type ActivityPlugin = {
  key: string;
  name: string;
  db: {
    namespace: string;
    tables: readonly string[];
    notes?: readonly string[];
  };
  activities: ActivityDefinition[];
};
```

### `ActivityDefinition`

Key fields:

- `key`
- `name`
- `description`
- `i18n`
- `defaultConfig`
- `configSchema`
- `metadataSchema`

### `ServerActivityPlugin`

Defined in:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

Typical shape:

```ts
type ServerActivityPlugin = {
  key: string;
  routes?: readonly PluginRouteDefinition[];
  hooks?: {
    onCourseActivityCreatedFromBankVersion?: CourseActivityCreatedFromBankVersionHook;
    onCourseActivityPublishedToBank?: CourseActivityPublishedToBankHook;
  };
};
```

### `ContentTypePlugin`

Defined in:

- [packages/content-type-sdk/src/index.ts](../../packages/content-type-sdk/src/index.ts)

Typical shape:

```ts
type ContentTypePlugin = {
  key: string;
  packageName: string;
  name: string;
  version?: string;
  db: {
    namespace: string;
    tables: readonly string[];
    notes?: readonly string[];
  };
  contentTypes: ContentTypeDefinition[];
};
```

Key `ContentTypeDefinition` fields:

- `key`
- `label`
- `description`
- `defaultTitle`
- `icon`
- `createMode`
- `embeddingSource`
- `settingsRendererKey`

### `ServerContentTypePlugin`

Defined in:

- [packages/content-type-sdk/src/server.ts](../../packages/content-type-sdk/src/server.ts)

Typical shape:

```ts
type ServerContentTypePlugin = {
  key: string;
  routes?: readonly ContentTypeRouteDefinition[];
  handlers?: {
    create?: ContentTypeCreateHandler;
    update?: ContentTypeUpdateHandler;
    delete?: ContentTypeDeleteHandler;
    resolveOpenAction?: ContentTypeOpenActionHandler;
    getEmbeddingSource?: ContentTypeEmbeddingSourceHandler;
  };
};
```

`getEmbeddingSource` must return a generic descriptor:

```ts
type ContentEmbeddingSource =
  | { kind: "text"; text: string; sourceId: string }
  | { kind: "file"; fileRef: string; mimeType?: string; sourceId: string }
  | { kind: "external_url"; url: string; sourceId: string }
  | { kind: "none"; sourceId: string };
```

Future indexing services should call core's generic `getContentResourceEmbeddingSource` instead of importing your plugin directly.

## Minimal Plugin Example

```ts
import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";

export const tracingQuizPlugin: ActivityPlugin = {
  key: "tracing-quiz",
  name: "Tracing quiz",
  db: {
    namespace: "plugin_tracing_quiz",
    tables: [],
    notes: ["Tracing quiz currently uses only core activity records."]
  },
  activities: [
    {
      key: "tracing-quiz",
      name: "Tracing quiz",
      description: "Predict program output.",
      defaultConfig: {
        prompt: "What does this print?",
        language: "python",
        starterCode: "print(2 + 3)",
        expectedOutput: "5"
      },
      configSchema: z.object({
        prompt: z.string().min(1).max(4000).default("What does this print?"),
        language: z.string().min(1).max(40).default("python"),
        starterCode: z.string().min(1).max(20000).default("print('hello')"),
        expectedOutput: z.string().min(1).max(10000).default("hello")
      }),
      metadataSchema: z.object({
        researchTags: z.array(z.string()).default([]),
        instrumented: z.boolean().default(false)
      })
    }
  ]
};
```

## Route Handler Example

Plugin routes are dispatched through the generic API route:

- [apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts)

You define route objects, not new app route files.

`context.courseId` is present in course and assigned-activity contexts. `context.activityBankId` is present in bank-authoring contexts. A plugin route that supports both should branch on these fields and keep the actual behavior in the plugin package.

Example:

```ts
import { z } from "zod";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";

const inputSchema = z.object({
  answer: z.string().min(1).max(10000)
});

export const tracingQuizSubmissionRoute: PluginRouteDefinition = {
  path: "tracing-quiz/submission",
  activityTypeKeys: ["tracing-quiz"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = inputSchema.parse(await readJson());
      return {
        ok: true,
        activityId: context.activity.id,
        userId: context.user.id,
        submittedAnswer: input.answer
      };
    }
  }
};
```

## Content Type Route Handler Example

Content type routes are dispatched through:

- [apps/api/src/app/api/courses/[courseId]/content-resources/[resourceId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/content-resources/[resourceId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/courses/[courseId]/groups/[groupId]/content-resources/[resourceId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/groups/[groupId]/content-resources/[resourceId]/[...pluginPath]/route.ts)

Example:

```ts
import type { ContentTypeRouteDefinition } from "@cognelo/content-type-sdk/server";

export const previewRoute: ContentTypeRouteDefinition = {
  path: "preview",
  contentTypeKeys: ["your-content-type"],
  methods: {
    GET: async ({ context }) => ({
      title: context.resource?.title,
      metadata: context.resource?.metadata ?? {}
    })
  }
};
```

## Shared UI You Can Reuse

Files:

- [packages/activity-ui/src/code-editor.tsx](../../packages/activity-ui/src/code-editor.tsx)
- [packages/activity-ui/src/code-renderer.tsx](../../packages/activity-ui/src/code-renderer.tsx)

Exports:

- `CodeEditor`
- `CodeRenderer`
- `codeLanguageOptions`
- `normalizeCodeLanguage`

Use them for programming-learning plugins instead of rebuilding a code widget.

## Data Model Guidance

Use `Activity.config` for:

- authoring settings
- learner-visible behavior
- prompt/content setup

Use `BankActivity.config` / `ActivityVersion.config` for reusable bank authoring state. When a bank activity is assigned to a course, this generic config is copied into the course `Activity.config`.

Use `Activity.metadata` for:

- research tags
- instrumentation flags
- cohort/condition labels
- analysis-oriented descriptors

Use plugin-owned tables for:

- private bank-owned authoring data
- private course-owned reference/test data copied from a bank
- attempts
- submissions
- event streams
- grade summaries
- detailed telemetry

For content type plugins, start with `CourseContentResource.metadata` for safe, student-visible resource metadata such as URLs, Markdown bodies, original file names, MIME types, and setup status. Move to plugin-owned tables when you need private data, extraction jobs, large metadata, provider-specific sync state, or records that should survive independently of a small JSON blob.

Content type plugin activation and enablement uses `ContentTypePluginInstallation`. Admins activate a discovered plugin first, then enable it for new resource creation. Disabled active plugins can still serve existing resources. Deactivation backs up plugin-owned tables and makes existing resources unavailable until reactivated.

Copy rule for plugin-owned data:

- Core creates the course-local `Activity` copy and preserves `bankActivityId` / `activityVersionId`.
- Core does not copy plugin-owned tables.
- If a plugin stores private bank-owned rows, the plugin must implement `onCourseActivityCreatedFromBankVersion` in its server plugin and copy those rows into course-owned plugin tables keyed by the new `activity.id`.
- If private authoring data can be edited in a course copy, also implement `onCourseActivityPublishedToBank` to replace the corresponding bank-owned rows when core publishes that course copy as a new immutable bank version. Do not copy attempts, submissions, grades, or other course-only/student data.
- The copied course rows must be independent snapshots. Later bank edits must not mutate existing course activity copies.
- Any new plugin-owned bank table should be reviewed together with the hook and a manual test that assigns a bank activity to a course.

Delete rule for plugin-owned bank data:

- Deleting a bank activity removes the generic bank row and versions.
- Course activities copied from it keep their local content/config but lose their bank provenance links and become course-local.
- Core does not know how to delete plugin-owned bank rows.
- If a plugin stores bank-owned private rows, it must implement `onBankActivityDeleted` and delete only the bank-owned rows for that `bankActivityId`.
- The hook must not delete course-owned plugin rows, submissions, attempts, or copied reference/test data.

## Current Grading State

There is no generic platform gradebook yet.

If your plugin needs grading today:

- keep grading logic in the plugin package
- store grading data in plugin-owned tables
- keep the schema easy to adapt later to a shared grade system

The `plugin-coding-homework-grader` package is currently a scaffold, not a finished shared grading subsystem.

## Verification

Always:

```bash
npm run typecheck
```

If Prisma changed:

```bash
npm run db:migrate:all
```

If seed behavior changed:

```bash
npm run db:seed
```

Manual checks:

- activity type appears in `/api/activity-types`
- activity can be created
- renderer shows up
- config save path works
- plugin routes work
- content type plugin routes work when building content plugins
- plugin tables receive data when expected
- content resources return the expected embedding source descriptor when building content plugins

## Best Files To Read

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)
- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)
- [packages/content-type-sdk/src/index.ts](../../packages/content-type-sdk/src/index.ts)
- [packages/content-type-sdk/src/server.ts](../../packages/content-type-sdk/src/server.ts)
- [packages/core/src/activities.ts](../../packages/core/src/activities.ts)
- [packages/core/src/course-content.ts](../../packages/core/src/course-content.ts)
- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)
- [apps/web/src/lib/content-type-renderers.tsx](../../apps/web/src/lib/content-type-renderers.tsx)
- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
- [packages/plugin-activities/plugin-placeholder/src/index.ts](../../packages/plugin-activities/plugin-placeholder/src/index.ts)
- [packages/plugin-activities/plugin-coding-homework-grader/src/index.ts](../../packages/plugin-activities/plugin-coding-homework-grader/src/index.ts)
- [packages/plugin-activities/plugin-parsons/src/plugin.ts](../../packages/plugin-activities/plugin-parsons/src/plugin.ts)
- [packages/plugin-activities/plugin-parsons/src/routes.ts](../../packages/plugin-activities/plugin-parsons/src/routes.ts)
- [packages/plugin-activities/plugin-parsons/src/db.ts](../../packages/plugin-activities/plugin-parsons/src/db.ts)
- [packages/plugin-content-types/plugin-github-repo/src/index.ts](../../packages/plugin-content-types/plugin-github-repo/src/index.ts)
- [packages/plugin-content-types/plugin-github-repo/src/server.ts](../../packages/plugin-content-types/plugin-github-repo/src/server.ts)
- [packages/plugin-content-types/plugin-file/src/index.ts](../../packages/plugin-content-types/plugin-file/src/index.ts)
- [packages/plugin-content-types/plugin-file/src/server.ts](../../packages/plugin-content-types/plugin-file/src/server.ts)
- [packages/plugin-content-types/plugin-text/src/index.ts](../../packages/plugin-content-types/plugin-text/src/index.ts)
- [packages/plugin-content-types/plugin-text/src/server.ts](../../packages/plugin-content-types/plugin-text/src/server.ts)

## Pick Your Path

- Want the short version: you are already here.
- Want the tutorial version: continue with [Cognelo And Next.js Basics](01-basics.md), jump to [Build Your First Plugin](05-build-your-first-plugin.md), or build a content type with [Build Your First Content Type Plugin](07-build-your-first-content-type-plugin.md).
