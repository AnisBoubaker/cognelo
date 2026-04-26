# Build A Real Plugin

Back to the [handbook index](README.md)

This chapter walks through the full shape of a practical plugin.

## The Smallest Working Path

To make a plugin feel “real,” you usually need three things:

1. plugin registration
2. frontend rendering
3. optional plugin-specific routes or persistence

Let’s walk through those in order.

## Step 1: Define The Plugin

Example:

```ts
import { z } from "zod";
import type { ActivityPlugin } from "@cognelo/activity-sdk";

export const tracingQuizPlugin: ActivityPlugin = {
  key: "tracing-quiz",
  name: "Tracing quiz",
  db: {
    namespace: "plugin_tracing_quiz",
    tables: [],
    notes: ["This plugin starts with core activity storage only."]
  },
  activities: [
    {
      key: "tracing-quiz",
      name: "Tracing quiz",
      description: "Predict program execution and output.",
      defaultConfig: {
        language: "python",
        starterCode: "",
        expectedOutput: ""
      },
      configSchema: z.object({
        language: z.string().min(1).max(40).default("python"),
        starterCode: z.string().max(20000).default(""),
        expectedOutput: z.string().max(10000).default("")
      })
    }
  ]
};
```

## Step 2: Register It In The SDK

In:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)

add your import and add the plugin to the `plugins` array.

This is what makes the activity type visible to the platform.

## Step 3: Add A Renderer

Create a React component in your plugin package, for example:

```text
packages/plugins/plugin-tracing-quiz/src/web/tracing-quiz-view.tsx
```

Example:

```tsx
import { useState } from "react";
import { CodeEditor, useNotifications } from "@cognelo/activity-ui";

export function TracingQuizView({ activity, canManage, onSave }: any) {
  const config = activity.config ?? {};
  const [starterCode, setStarterCode] = useState(String(config.starterCode ?? ""));
  const notifications = useNotifications();

  if (!canManage) {
    return (
      <section className="section stack">
        <h2>{activity.title}</h2>
        <CodeEditor value={starterCode} onChange={() => {}} language="python" minHeight={240} />
      </section>
    );
  }

  return (
    <section className="section stack">
      <h2>Authoring</h2>
      <CodeEditor value={starterCode} onChange={setStarterCode} language="python" minHeight={240} />
      <button
        type="button"
        onClick={async () => {
          await onSave({
            title: activity.title,
            description: activity.description,
            config: {
              ...config,
              starterCode
            }
          });
          notifications.success("Tracing quiz saved.");
        }}
      >
        Save
      </button>
    </section>
  );
}
```

Then register the renderer in:

- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)

When you need transient confirmation or error feedback in plugin UI, prefer `useNotifications()` over a plugin-specific inline save banner.

## Step 4: Add Plugin Routes If Needed

If the plugin needs actions beyond save/load of the generic activity record, add plugin routes.

Example route definition:

```ts
import { z } from "zod";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";

const submitSchema = z.object({
  answer: z.string().min(1).max(10000)
});

export const tracingQuizSubmitRoute: PluginRouteDefinition = {
  path: "tracing-quiz/submission",
  activityTypeKeys: ["tracing-quiz"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = submitSchema.parse(await readJson());
      return {
        ok: true,
        activityId: context.activity.id,
        userId: context.user.id,
        answer: input.answer
      };
    }
  }
};
```

Then export a server plugin in `src/server.ts` and register it in:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

Do not add plugin-specific route files under `apps/api`. The API app owns generic dispatchers for course activities, assigned section/group activities, and activity-bank activities. Plugin-specific behavior belongs in the plugin route definitions.

If the same route must work in both course-copy and bank-authoring contexts, branch on `context.courseId` and `context.activityBankId`.

## Step 5: Add Client-Side API Helpers

If your plugin route is called from the browser, add a helper in:

- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)

Example:

```ts
submitTracingQuiz: (courseId: string, activityId: string, input: { answer: string }) =>
  request<{ ok: true }>(`/courses/${courseId}/activities/${activityId}/tracing-quiz/submission`, {
    method: "POST",
    body: JSON.stringify(input)
  })
```

For bank-authoring plugin routes, use the activity-bank dispatcher path:

```ts
saveTracingQuizBankData: (activityBankId: string, bankActivityId: string, input: { answer: string }) =>
  request<{ ok: true }>(`/activity-banks/${activityBankId}/activities/${bankActivityId}/tracing-quiz/submission`, {
    method: "POST",
    body: JSON.stringify(input)
  })
```

## Step 6: Add Persistence If Needed

If learner attempts or submissions need to survive reloads, add plugin-owned tables to:

- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma)

Parsons is the best example of this pattern.

Good reasons to add persistence:

- submissions
- attempts
- grade summaries
- hint histories
- event streams
- private bank-owned reference data that should be copied into course-owned plugin tables when assigned

## Step 7: Copy Private Bank Data If Needed

The platform copies generic bank activity config/title/metadata into a course activity when the teacher adds a bank activity to a course. If your plugin has private bank-owned data, such as tests or reference files, the plugin must copy that data through a server hook.

Example:

```ts
export const tracingQuizServerPlugin: ServerActivityPlugin = {
  key: "tracing-quiz",
  routes: [tracingQuizSubmitRoute],
  hooks: {
    onCourseActivityCreatedFromBankVersion: async ({ activity, bankActivityId }) => {
      if (activity.activityType.key !== "tracing-quiz") {
        return;
      }

      await copyBankTracingQuizDataToCourseActivity({
        bankActivityId,
        activityId: activity.id
      });
    }
  }
};
```

This preserves the copy semantics: later bank edits do not affect existing course activity copies.

## Recommended Development Order

For beginners, this sequence is usually easier than trying to build everything at once:

1. make the plugin register correctly
2. make the activity type visible
3. make a simple renderer appear
4. make authoring changes save
5. add plugin route(s)
6. add database storage
7. add bank-to-course copy hooks for plugin-owned private data
8. add research instrumentation

## A Good First Milestone

A very good first milestone is:

- your activity type appears in `/api/activity-types`
- you can create one in the UI
- it renders your React component
- saving updates `config`

Once that works, you have a real plugin.

Previous: [Core Services You Can Reuse](03-core-services.md)

Next: [Build Your First Plugin](05-build-your-first-plugin.md)
