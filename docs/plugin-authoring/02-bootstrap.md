# Bootstrap A Plugin

Back to the [handbook index](README.md)

This chapter shows how to create your first plugin package.

## The Easiest Starting Point

There is no plugin generator yet. The easiest approach is to copy an existing plugin and adapt it.

Choose the closest starting point:

- `plugin-placeholder` for the simplest possible plugin
- `plugin-homework-grader` if you want a config schema example
- `plugin-parsons` if you need routes, persistence, and custom UI

For a beginner, `plugin-placeholder` is usually the best starting point.

## Example Bootstrap Flow

From the repository root:

```bash
cp -R packages/plugins/plugin-placeholder packages/plugins/plugin-my-activity
```

Then search for the old names:

```bash
rg -n "placeholder|Placeholder" packages/plugins/plugin-my-activity
```

Update:

- package name in `package.json`
- exported plugin symbol name
- plugin key
- activity type key
- README title and text
- PROJECT_MEMORY title and text

## Minimal Package Structure

A simple plugin can start with:

```text
packages/plugins/plugin-my-activity/
  README.md
  PROJECT_MEMORY.md
  package.json
  tsconfig.json
  src/
    index.ts
```

Later you can add:

- `plugin.ts`
- `server.ts`
- `routes.ts`
- `db.ts`
- `web/`

## Example Minimal Plugin

```ts
import type { ActivityPlugin } from "@cognelo/activity-sdk";

export const myActivityPlugin: ActivityPlugin = {
  key: "my-activity",
  name: "My activity",
  db: {
    namespace: "plugin_my_activity",
    tables: [],
    notes: ["This plugin currently uses only core activity records."]
  },
  activities: [
    {
      key: "my-activity",
      name: "My activity",
      description: "A new Cognelo activity type.",
      i18n: {
        en: {
          name: "My activity",
          description: "A new Cognelo activity type.",
          defaultTitle: "My activity"
        }
      },
      defaultConfig: {}
    }
  ]
};
```

## What Do These Fields Mean?

### `key` on the plugin

This identifies the plugin package/domain. Keep it stable.

### `activities`

A plugin can define one or more activity types. Many plugins only define one, but the contract allows more.

### `defaultConfig`

This is the starting config for newly created activities. It should be safe and valid.

### `db`

This does not create tables by itself. It is a description of the plugin’s persistence footprint. Think of it as documentation and registration metadata.

## Register The Plugin

Once the plugin exists, it is not active until you register it.

Add it to:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)

Pattern:

```ts
import { myActivityPlugin } from "@cognelo/plugin-my-activity";

const plugins: ActivityPlugin[] = [
  placeholderPlugin,
  homeworkGraderPlugin,
  parsonsPlugin,
  myActivityPlugin
];
```

This is the moment your plugin becomes visible to the platform.

## What Registration Unlocks

Once registered, your plugin can participate in:

- activity definition listing
- activity type seeding
- activity creation/update validation
- activity type discovery in the UI/API

## Add Validation Early

Even for a beginner plugin, it is a good idea to add a Zod config schema.

Example:

```ts
import { z } from "zod";

configSchema: z.object({
  prompt: z.string().min(1).max(4000).default(""),
  language: z.string().min(1).max(40).default("python")
})
```

This keeps invalid activity configs from being saved.

## Beginner Tip

Do not try to build routes, UI, persistence, and research instrumentation all at once.

A good first milestone is:

1. create the plugin package
2. register it
3. make it appear as an activity type
4. give it a valid default config

Then add UI and routes one layer at a time.

Previous: [Cognelo And Next.js Basics](01-basics.md)

Next: [Core Services You Can Reuse](03-core-services.md)
