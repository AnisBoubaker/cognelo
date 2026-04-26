# Build Your First Plugin

Back to the [handbook index](README.md)

This chapter is a hands-on walkthrough. We will build a small example plugin from start to finish.

The goal is not to build a perfect production plugin. The goal is to help a beginner understand the whole flow:

- create a plugin package
- define an activity type
- register it
- add a frontend renderer
- optionally add a custom route
- verify that it works

We will use a fictional example called `tracing-quiz`.

## What This Example Plugin Does

The `tracing-quiz` plugin lets a teacher define:

- a prompt
- a code snippet
- an expected output

Then a student can read the code and submit an answer predicting the output.

That makes it a good tutorial example because it is:

- simple enough to understand
- realistic enough to feel useful
- close to the programming-learning goals of Cognelo

## Step 0: Choose A Starting Template

For a first plugin, copy the placeholder plugin:

```bash
cp -R packages/plugins/plugin-placeholder packages/plugins/plugin-tracing-quiz
```

Why the placeholder plugin?

- it is small
- it has very little extra code to remove
- it already follows the monorepo package conventions

## Step 1: Rename The Package Metadata

Search for the old placeholder name:

```bash
rg -n "placeholder|Placeholder" packages/plugins/plugin-tracing-quiz
```

Update the package metadata in `package.json` so it becomes:

```json
{
  "name": "@cognelo/plugin-tracing-quiz",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

At this stage, do not worry about every detail. The important thing is that:

- the package has a new name
- the plugin code will export a new symbol
- the old placeholder terminology is gone

## Step 2: Replace The Minimal Plugin Definition

In `packages/plugins/plugin-tracing-quiz/src/index.ts`, replace the placeholder example with a tracing quiz plugin.

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
      description: "Predict the output of a short program.",
      i18n: {
        en: {
          name: "Tracing quiz",
          description: "Predict the output of a short program.",
          defaultTitle: "Tracing quiz"
        },
        fr: {
          name: "Quiz de trace",
          description: "Prédire la sortie d'un petit programme.",
          defaultTitle: "Quiz de trace"
        },
        zh: {
          name: "程序跟踪测验",
          description: "预测短程序的输出。",
          defaultTitle: "程序跟踪测验"
        }
      },
      defaultConfig: {
        prompt: "What does this program print?",
        language: "python",
        starterCode: "total = 2 + 3\nprint(total)",
        expectedOutput: "5"
      },
      configSchema: z.object({
        prompt: z.string().min(1).max(4000).default("What does this program print?"),
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

## Why This Is Enough To Start

This definition already gives you:

- an activity type key
- a visible display name
- localized labels
- a safe default config
- config validation
- metadata validation

That means the platform can already:

- register the activity type
- seed it as an available activity type
- validate it when created or updated

## Step 3: Register The Plugin In The SDK

Open:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)

Add an import:

```ts
import { tracingQuizPlugin } from "@cognelo/plugin-tracing-quiz";
```

Then add it to the `plugins` array:

```ts
const plugins: ActivityPlugin[] = [placeholderPlugin, homeworkGraderPlugin, parsonsPlugin, tracingQuizPlugin];
```

Why this matters:

- without this registration, the plugin exists only as code on disk
- with this registration, the platform can discover and use it

## Step 4: Verify The Activity Type Exists

At this point, your plugin still has no custom UI. That is okay.

Run:

```bash
npm run typecheck
```

Then start the app:

```bash
npm run dev
```

Now check the activity-type listing:

```text
GET /api/activity-types
```

You should expect the new `tracing-quiz` activity type to appear there.

That is the first major checkpoint.

## Step 5: Add A Frontend Renderer

Now let’s make the activity actually render something useful in the browser.

Create:

```text
packages/plugins/plugin-tracing-quiz/src/web/tracing-quiz-view.tsx
```

Example:

```tsx
import { useState } from "react";
import { CodeEditor, CodeRenderer } from "@cognelo/activity-ui";

type TracingQuizViewProps = {
  activity: {
    title: string;
    description: string;
    config?: Record<string, unknown>;
  };
  canManage: boolean;
  onSave: (input: { title: string; description: string; config: Record<string, unknown> }) => Promise<unknown>;
};

export function TracingQuizView({ activity, canManage, onSave }: TracingQuizViewProps) {
  const config = activity.config ?? {};
  const [prompt, setPrompt] = useState(String(config.prompt ?? ""));
  const [language, setLanguage] = useState(String(config.language ?? "python"));
  const [starterCode, setStarterCode] = useState(String(config.starterCode ?? ""));
  const [expectedOutput, setExpectedOutput] = useState(String(config.expectedOutput ?? ""));

  if (!canManage) {
    return (
      <section className="section stack">
        <h2>{activity.title}</h2>
        <p>{prompt}</p>
        <CodeRenderer code={starterCode} language={language} showLineNumbers />
        <label>
          Your predicted output
          <textarea rows={4} />
        </label>
      </section>
    );
  }

  return (
    <section className="section stack">
      <h2>Authoring</h2>

      <label>
        Prompt
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} />
      </label>

      <label>
        Language
        <input value={language} onChange={(event) => setLanguage(event.target.value)} />
      </label>

      <div className="stack">
        <span>Starter code</span>
        <CodeEditor value={starterCode} onChange={setStarterCode} language={language} minHeight={240} />
      </div>

      <label>
        Expected output
        <textarea value={expectedOutput} onChange={(event) => setExpectedOutput(event.target.value)} rows={4} />
      </label>

      <button
        type="button"
        onClick={() =>
          onSave({
            title: activity.title,
            description: activity.description,
            config: {
              prompt,
              language,
              starterCode,
              expectedOutput
            }
          })
        }
      >
        Save
      </button>
    </section>
  );
}
```

## Why This Example Is Helpful

This view demonstrates two useful ideas:

- teachers and students can see different UI paths
- plugin UI can reuse the shared `CodeEditor` and `CodeRenderer`

It also shows that your plugin does not need to invent its own editor widget.

## Step 6: Export The Renderer

Open your plugin package entry file and export the new component:

```ts
export * from "./web/tracing-quiz-view";
export * from "./index";
```

In a real package, you would usually split the plugin definition into `plugin.ts` and use:

```ts
export * from "./plugin";
export * from "./web/tracing-quiz-view";
```

That structure is often cleaner than keeping everything in one file.

## Step 7: Register The Renderer In The Web App

Open:

- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)

Add an import:

```ts
import { TracingQuizView } from "@cognelo/plugin-tracing-quiz";
```

Then register it:

```ts
export const activityRenderers = {
  "parsons-problem": ParsonsActivityRenderer,
  "tracing-quiz": TracingQuizView
} as const;
```

Now when the activity page loads an activity of type `tracing-quiz`, the web app knows which component to render.

## Step 8: Try The Full UI Flow

At this point you should be able to:

1. create a `tracing-quiz` activity
2. open its page
3. see your plugin UI
4. edit the config as a teacher
5. save it through the shared `onSave` flow

This is already a complete first plugin, even without custom routes or plugin-specific tables.

That is an important lesson: not every plugin needs every extension point on day one.

## Step 9: Add A Custom Submission Route

Now let’s add one plugin-specific endpoint so the example feels truly end-to-end.

Create:

```text
packages/plugins/plugin-tracing-quiz/src/routes.ts
```

Example:

```ts
import { z } from "zod";
import type { PluginRouteDefinition } from "@cognelo/activity-sdk/server";

const submissionSchema = z.object({
  answer: z.string().min(1).max(10000)
});

export const tracingQuizSubmissionRoute: PluginRouteDefinition = {
  path: "tracing-quiz/submission",
  activityTypeKeys: ["tracing-quiz"],
  methods: {
    POST: async ({ context, readJson }) => {
      const input = submissionSchema.parse(await readJson());

      return {
        ok: true,
        activityId: context.activity.id,
        userId: context.user.id,
        submittedAnswer: input.answer,
        expectedOutput: context.activity.config?.expectedOutput ?? null
      };
    }
  }
};
```

This example is intentionally simple. It does not grade anything yet. It just proves the route works and receives the right context.

## Step 10: Export A Server Plugin

Create:

```text
packages/plugins/plugin-tracing-quiz/src/server.ts
```

Example:

```ts
import type { ServerActivityPlugin } from "@cognelo/activity-sdk/server";
import { tracingQuizSubmissionRoute } from "./routes";

export const tracingQuizServerPlugin: ServerActivityPlugin = {
  key: "tracing-quiz",
  routes: [tracingQuizSubmissionRoute]
};
```

## Step 11: Register The Server Plugin

Open:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

Add:

```ts
import { tracingQuizServerPlugin } from "@cognelo/plugin-tracing-quiz/server";
```

and register it in the `serverPlugins` array.

Now the generic API dispatchers can route requests to your plugin. Cognelo has dispatchers for course activity authoring, section/group assigned activity work, and activity-bank authoring. Keep plugin behavior in plugin route definitions rather than creating plugin-specific route files under `apps/api`.

## Step 12: Add A Browser API Helper

Open:

- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)

Add a helper:

```ts
submitTracingQuiz: (courseId: string, activityId: string, input: { answer: string }) =>
  request<{ ok: true; expectedOutput: string | null }>(
    `/courses/${courseId}/activities/${activityId}/tracing-quiz/submission`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  )
```

This makes it easy for your React component to call the plugin route.

If the same plugin route is needed while authoring inside an activity bank, add a second helper that uses `/activity-banks/:activityBankId/activities/:bankActivityId/...`.

## Step 13: Wire The Student Submission UI

Back in your `TracingQuizView`, you could add:

```tsx
const [answer, setAnswer] = useState("");
const [result, setResult] = useState<string | null>(null);
```

Then in the student branch:

```tsx
<label>
  Your predicted output
  <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={4} />
</label>

<button
  type="button"
  onClick={async () => {
    const response = await api.submitTracingQuiz(course.id, activity.id, { answer });
    setResult(response.expectedOutput);
  }}
>
  Submit
</button>
```

Even if this is still a toy example, it shows the complete vertical slice:

- plugin config
- plugin UI
- plugin route
- browser API helper
- backend context

## Step 14: Decide Whether You Need Persistence

At this point, ask a design question:

"Does this plugin need to remember student submissions after refresh?"

If the answer is no, stop here. The plugin is already useful for learning the architecture.

If the answer is yes, then add plugin-owned persistence in Prisma.

For example, you might create:

```prisma
model PluginTracingQuizSubmission {
  id            String   @id @default(cuid())
  activityId    String
  userId        String
  submittedText String
  resultSummary Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([activityId, userId, createdAt])
}
```

That would let you keep a full history of learner submissions.

## Step 15: Verify Everything

Run:

```bash
npm run typecheck
```

If you added Prisma models:

```bash
npm run db:generate
npm run db:migrate
```

Then:

```bash
npm run dev
```

Checklist:

- the plugin appears in `/api/activity-types`
- the activity can be created
- the activity page renders your plugin
- saving config works
- the custom submission route responds
- if persistence was added, rows appear in the new plugin table

## What You Learned In This Walkthrough

By the end of this tutorial, you have seen:

- how plugin packages are created
- how activity definitions work
- how the SDK registry activates a plugin
- how a renderer is connected to the activity page
- how custom plugin routes are dispatched
- how the web app calls those routes
- where persistence fits if you need it

That is the core of plugin authoring in Cognelo.

## What You Can Improve Next

Once this basic plugin works, typical next improvements would be:

- use stronger TypeScript types in the React component props
- split the plugin definition into `plugin.ts`
- split the web UI into teacher and student subcomponents
- add route error handling
- add persistence for submissions
- add metadata for research grouping or instrumentation
- add grading logic

## Final Beginner Advice

Do not judge your first plugin by whether it has every advanced feature.

A successful first plugin is one that teaches you the architecture and gives you confidence with:

- registration
- rendering
- routes
- validation

That is enough to unlock the rest.

Previous: [Build A Real Plugin](04-building-a-plugin.md)

Next: [Data, Research, And Grading](05-data-research-and-grading.md)
