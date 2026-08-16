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
- subject creation/update
- activity bank creation/update
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
- creating course activity copies from activity-bank versions
- updating activities
- deleting activities

When a local course activity is created or updated, the core service:

1. loads the activity definition for the chosen activity type
2. merges `defaultConfig` with incoming config
3. validates config with `configSchema`
4. validates metadata with `metadataSchema` when present
5. stores the result in the generic `Activity` table

This is a big convenience. It means your plugin does not need its own separate “create activity” endpoint just to validate plugin config.

When an activity is created from an activity bank, the core service copies the selected/latest `ActivityVersion` into a course-local `Activity`. The course activity keeps provenance fields (`bankActivityId`, `activityVersionId`) but is not live-linked to future bank edits.

Plugins that store private bank-owned data must use `ServerActivityPlugin.hooks.onCourseActivityCreatedFromBankVersion` to copy that data into course-owned plugin tables.

Explicit synchronization uses that same hook to replace course-owned private authoring data during bank retrieval. Plugins whose course copies have private editable authoring data must also implement `ServerActivityPlugin.hooks.onCourseActivityPublishedToBank` to replace bank-owned authoring rows. Core creates the new immutable version, checks bank write access, and blocks synchronization after any attempt; plugins must never publish attempts, submissions, grades, or course-only runtime artifacts.

Core only creates the generic course-local `Activity` row and copies selected `ActivityVersion` fields. It does not know the schema or semantics of plugin-owned tables. If your plugin has bank-owned private rows, the hook is required. The hook should create independent course-owned rows keyed by the new `activity.id`, so future bank edits do not alter existing course activities.

Plugins that store private bank-owned data must also use `ServerActivityPlugin.hooks.onBankActivityDeleted` to remove bank-owned private rows when a bank activity is deleted. This cleanup must leave copied course-owned rows alone, because existing course activities become course-local copies after their bank links are cleared.

## Plugin Route Dispatch

The shared plugin route system lives in:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

and is consumed by the API route:

- [apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts)

What this gives you:

- auth is already enforced
- course activity authoring routes require course-management permission
- activity-bank routes require bank-management permission
- assigned section/group routes validate access to the concrete assignment
- the activity is already loaded
- the route is matched by activity type and path
- your handler receives a clean context object

Route matching is fail-closed: every `PluginRouteDefinition` must explicitly list `activityTypeKeys`. Omitting that list makes the route undispatchable. Handlers must still enforce operation-specific rules, such as requiring a student participant for submission or a manager for gradebook review.

Cookie-authenticated unsafe requests are protected centrally by an exact `Origin`/`CORS_ORIGIN` match, including JSON and multipart plugin mutations. Do not bypass the generic dispatcher or invent a weaker plugin-local CORS/CSRF path.

That context includes:

- the current user
- the course id when dispatched in a course or assigned-activity context
- the activity bank id when dispatched in a bank-authoring context
- the activity id
- the current activity record
- the matched plugin path

For beginners, this is much easier than designing a totally separate API architecture.

## Shared UI: Code Editor, Code Renderer, Markdown, Notifications, And Unsaved Changes

Shared UI primitives live in:

- [packages/activity-ui/src/code-editor.tsx](../../packages/activity-ui/src/code-editor.tsx)
- [packages/activity-ui/src/code-renderer.tsx](../../packages/activity-ui/src/code-renderer.tsx)
- [packages/activity-ui/src/markdown-renderer.tsx](../../packages/activity-ui/src/markdown-renderer.tsx)
- [packages/activity-ui/src/notifications.tsx](../../packages/activity-ui/src/notifications.tsx)
- [packages/activity-ui/src/unsaved-changes.tsx](../../packages/activity-ui/src/unsaved-changes.tsx)

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

### What `MarkdownRenderer` Gives You

- shared Markdown display for authored prompts and descriptions
- one rendering path for both core pages and plugins
- safer HTML handling instead of ad hoc `dangerouslySetInnerHTML` usage in each plugin

### What `useNotifications()` Gives You

- shared bottom-right snackbar-style notifications
- a single pattern for success, error, and informational messages
- reuse across core forms and plugin UIs without each plugin inventing its own save banner

Use this for transient confirmations and non-field-specific errors.

Prefer it over inline “saved” messages when the feedback does not need to stay attached to a specific form field.

### What `useUnsavedChangesGuard()` Gives You

- a shared dirty-form registration point for plugin and core forms
- the platform dialog for internal navigation, with continue editing, save and leave, or discard and leave actions
- browser-native `beforeunload` protection for refresh and tab close

Every plugin authoring or settings form should register with this hook. Keep an initial saved snapshot, compute `isDirty` from the current local state, and provide `onSave` and `onDiscard` callbacks. This avoids duplicating navigation prompts inside each plugin and keeps course, bank, and settings forms consistent.

### Example

```tsx
import {
  CodeEditor,
  CodeRenderer,
  MarkdownRenderer,
  useNotifications,
  useUnsavedChangesGuard
} from "@cognelo/activity-ui";

export function Demo() {
  const [value, setValue] = useState("print('hello')");
  const [savedValue, setSavedValue] = useState(value);
  const notifications = useNotifications();

  useUnsavedChangesGuard({
    id: "demo-plugin-form",
    isDirty: value !== savedValue,
    onSave: async () => {
      await saveValue(value);
      setSavedValue(value);
      notifications.success("Saved.");
    },
    onDiscard: () => setValue(savedValue)
  });

  return (
    <section className="stack">
      <MarkdownRenderer markdown={"## Prompt\nWrite `hello` to the console."} />
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

Shared platform Prisma schema lives in:

- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma)

Do not add plugin-owned activity data models there. A plugin that needs persistence owns its own Prisma schema, migrations, generated client, and database manifest inside the plugin package.

That means:

- there is one physical database
- plugin tables live alongside core tables
- plugin code talks to plugin tables through a plugin-local Prisma client
- the core Prisma client only models platform-owned data

For beginners, this is easier than managing multiple services.

## What You Should Not Rebuild In A Plugin

Try not to rebuild these in plugin code:

- auth
- generic activity CRUD
- generic course membership logic
- generic subject/activity-bank/course-copy logic
- generic syntax-highlighted code editing
- base request validation patterns

Use the shared platform first. Only add plugin-specific code where the shared platform stops.

Previous: [Bootstrap A Plugin](02-bootstrap.md)

Next: [Build A Real Plugin](04-building-a-plugin.md)
