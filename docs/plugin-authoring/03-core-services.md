# Core Services You Can Reuse

Back to the [handbook index](README.md)

This chapter explains what the platform already gives you, so you do not rebuild it inside your plugin.

## Shared Contracts

Shared contracts live in:

- [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts)

These define common concepts such as:

- users
- roles
- activity lifecycle
- course creation/update
- activity creation/update

For a plugin author, the most important shared concept is that activities already have:

- `config`
- `metadata`
- `lifecycle`
- `title`
- `description`

Your plugin usually extends behavior through `config`, `metadata`, custom UI, and optional plugin-owned storage.

## Core Activity Service

The core activity service lives in:

- [packages/core/src/activities.ts](../../packages/core/src/activities.ts)

This service already handles:

- listing activity types
- looking up activity definitions
- creating activities
- updating activities
- deleting activities

When an activity is created or updated, the core service:

1. loads the activity definition for the chosen activity type
2. merges `defaultConfig` with incoming config
3. validates config with `configSchema`
4. validates metadata with `metadataSchema` when present
5. stores the result in the generic `Activity` table

This is a big convenience. It means your plugin does not need its own separate “create activity” endpoint just to validate plugin config.

## Plugin Route Dispatch

The shared plugin route system lives in:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

and is consumed by the API route:

- [apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts)

What this gives you:

- auth is already enforced
- the activity is already loaded
- the route is matched by activity type and path
- your handler receives a clean context object

That context includes:

- the current user
- the course id
- the activity id
- the current activity record
- the matched plugin path

For beginners, this is much easier than designing a totally separate API architecture.

## Shared UI: Code Editor, Code Renderer, And Notifications

Shared UI primitives live in:

- [packages/activity-ui/src/code-editor.tsx](../../packages/activity-ui/src/code-editor.tsx)
- [packages/activity-ui/src/code-renderer.tsx](../../packages/activity-ui/src/code-renderer.tsx)
- [packages/activity-ui/src/notifications.tsx](../../packages/activity-ui/src/notifications.tsx)

These are especially useful for programming-learning activities.

### What `CodeEditor` Gives You

- syntax-highlighted editing overlay
- automatic growing height
- tab indentation
- shift-tab unindent
- optional left and right rails for extra controls

### What `CodeRenderer` Gives You

- syntax highlighting
- line numbers
- normalized language handling

### What `useNotifications()` Gives You

- shared bottom-right snackbar-style notifications
- a single pattern for success, error, and informational messages
- reuse across core forms and plugin UIs without each plugin inventing its own save banner

Use this for transient confirmations and non-field-specific errors.

Prefer it over inline “saved” messages when the feedback does not need to stay attached to a specific form field.

### Example

```tsx
import { CodeEditor, CodeRenderer, useNotifications } from "@cognelo/activity-ui";

export function Demo() {
  const [value, setValue] = useState("print('hello')");
  const notifications = useNotifications();

  return (
    <section className="stack">
      <CodeEditor value={value} onChange={setValue} language="python" />
      <CodeRenderer code={value} language="python" showLineNumbers />
      <button type="button" onClick={() => notifications.success("Saved.")}>
        Save
      </button>
    </section>
  );
}
```

## API Helpers On The Web Side

The web app collects API helpers in:

- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)

This is where plugin-specific client calls currently go.

Parsons already follows this pattern with:

- `ensureParsonsAttempt`
- `updateParsonsAttempt`

If your plugin adds a route such as:

```text
/tracing-quiz/submission
```

then the matching browser-side helper should usually be added to `apps/web/src/lib/api.ts`.

## Activity Renderers

Activity renderers are mapped in:

- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)

This is how the web app knows which React component to show for a given activity type key.

If your renderer is not added there, the activity may exist in the database but still render as unsupported in the browser.

## Prisma And The Shared Database

Shared Prisma schema lives in:

- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma)

Plugins can extend this shared schema with plugin-owned tables.

That means:

- there is one database
- plugin tables live alongside core tables
- the ownership boundary is logical, not “separate database per plugin”

For beginners, this is easier than managing multiple services.

## What You Should Not Rebuild In A Plugin

Try not to rebuild these in plugin code:

- auth
- generic activity CRUD
- generic course membership logic
- generic syntax-highlighted code editing
- base request validation patterns

Use the shared platform first. Only add plugin-specific code where the shared platform stops.

Previous: [Bootstrap A Plugin](02-bootstrap.md)

Next: [Build A Real Plugin](04-building-a-plugin.md)
