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
- `packages/core`: shared business logic
- `packages/contracts`: shared schemas/types
- `packages/db`: Prisma schema, migrations, seed
- `packages/plugins/*`: plugin packages

Plugins own activity-specific behavior. The platform owns generic auth, subject/activity-bank/course/activity CRUD, route dispatch, activity copying, and shared UI primitives.

For authored rich text display, use `MarkdownRenderer` from `@cognelo/activity-ui`. For transient confirmations and non-field-specific errors, use `useNotifications()` instead of adding a plugin-local inline “saved” banner.

For every plugin authoring or settings form, use `useUnsavedChangesGuard` from `@cognelo/activity-ui`. Keep a saved snapshot, compute `isDirty`, and provide `onSave` plus `onDiscard` so shared navigation can offer continue editing, save and leave, or discard and leave.

If a plugin adds AI-assisted generation that writes into authoring/configuration fields, confirm before replacing any non-empty existing content. Treat generation as a destructive overwrite unless it appends into a clearly separate draft area.

## Minimal Plugin Flow

1. Create `packages/plugins/plugin-your-plugin`
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

## Required Registration Points

### Activity definition registry

File:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)

What you add:

```ts
import { yourPlugin } from "@cognelo/plugin-your-plugin";

const plugins: ActivityPlugin[] = [
  placeholderPlugin,
  homeworkGraderPlugin,
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
  homeworkGraderServerPlugin,
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

## Recommended Package Shape

```text
packages/plugins/plugin-your-plugin/
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
  };
};
```

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

Copy rule for plugin-owned data:

- Core creates the course-local `Activity` copy and preserves `bankActivityId` / `activityVersionId`.
- Core does not copy plugin-owned tables.
- If a plugin stores private bank-owned rows, the plugin must implement `onCourseActivityCreatedFromBankVersion` in its server plugin and copy those rows into course-owned plugin tables keyed by the new `activity.id`.
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

The `plugin-homework-grader` package is currently a scaffold, not a finished shared grading subsystem.

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
- plugin tables receive data when expected

## Best Files To Read

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)
- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)
- [packages/core/src/activities.ts](../../packages/core/src/activities.ts)
- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)
- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
- [packages/plugins/plugin-placeholder/src/index.ts](../../packages/plugins/plugin-placeholder/src/index.ts)
- [packages/plugins/plugin-homework-grader/src/index.ts](../../packages/plugins/plugin-homework-grader/src/index.ts)
- [packages/plugins/plugin-parsons/src/plugin.ts](../../packages/plugins/plugin-parsons/src/plugin.ts)
- [packages/plugins/plugin-parsons/src/routes.ts](../../packages/plugins/plugin-parsons/src/routes.ts)
- [packages/plugins/plugin-parsons/src/db.ts](../../packages/plugins/plugin-parsons/src/db.ts)

## Pick Your Path

- Want the short version: you are already here.
- Want the tutorial version: continue with [Cognelo And Next.js Basics](01-basics.md) or jump to [Build Your First Plugin](05-build-your-first-plugin.md).
