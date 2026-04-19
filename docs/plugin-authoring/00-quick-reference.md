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
- `packages/activity-ui`: shared code editor/renderer
- `packages/core`: shared business logic
- `packages/contracts`: shared schemas/types
- `packages/db`: Prisma schema, migrations, seed
- `packages/plugins/*`: plugin packages

Plugins own activity-specific behavior. The platform owns generic auth, course/activity CRUD, route dispatch, and shared UI primitives.

## Minimal Plugin Flow

1. Create `packages/plugins/plugin-your-plugin`
2. Export an `ActivityPlugin`
3. Register it in `packages/activity-sdk/src/index.ts`
4. If needed, export a `ServerActivityPlugin`
5. Register it in `packages/activity-sdk/src/server.ts`
6. If needed, export a React renderer
7. Register it in `apps/web/src/lib/activity-renderers.tsx`
8. If needed, add plugin tables in `packages/db/prisma/schema.prisma`
9. If needed, add browser API helpers in `apps/web/src/lib/api.ts`

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

You define route objects, not new app route files.

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

Use `Activity.metadata` for:

- research tags
- instrumentation flags
- cohort/condition labels
- analysis-oriented descriptors

Use plugin-owned tables for:

- attempts
- submissions
- event streams
- grade summaries
- detailed telemetry

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
npm run db:generate
npm run db:migrate
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
