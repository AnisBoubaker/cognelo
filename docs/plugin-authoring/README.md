# Plugin Authoring Handbook

This handbook explains plugin authoring for Cognelo in two styles:

- a short, straight-to-the-point reference for seasoned Next.js developers
- a beginner-friendly tutorial path for people newer to Next.js, monorepos, or plugin architectures

It is written for someone who may be new to:

- Next.js
- monorepos
- Prisma
- plugin architectures

If you already know your way around Next.js, start with the quick reference.

If you have never built a Cognelo plugin before, follow the beginner path in order.

## Plugin Families

Cognelo has two plugin families:

- **Activity plugins** create learner activities, authoring flows, attempts, grading hooks, and activity-specific routes.
- **Content type plugins** create non-activity course content resources such as GitHub repos, uploaded files, and text notes.

Both families use explicit registry packages and admin-managed activation/enablement. They stay separate because activities participate in banks, assignment, attempts, and grading, while content type plugins participate in the course content tree as resources.

## Fast Paths

- Experienced developer: [Plugin Authoring Quick Reference](00-quick-reference.md)
- Content type plugin tutorial: [Build Your First Content Type Plugin](07-build-your-first-content-type-plugin.md)
- Beginner path: start below and read in order

## Reading Path

1. [Cognelo And Next.js Basics](01-basics.md)
2. [Bootstrap A Plugin](02-bootstrap.md)
3. [Core Services You Can Reuse](03-core-services.md)
4. [Build A Real Plugin](04-building-a-plugin.md)
5. [Build Your First Plugin](05-build-your-first-plugin.md)
6. [Data, Research, And Grading](05-data-research-and-grading.md)
7. [Checklist And Reference](06-checklist-and-reference.md)
8. [Build Your First Content Type Plugin](07-build-your-first-content-type-plugin.md)

## What This Handbook Covers

- what a plugin is in Cognelo
- how the API app and web app fit together
- where plugin code belongs
- how to reuse the shared code editor and renderer
- how to register a plugin
- how to add plugin-specific UI, routes, and storage
- how to follow a complete end-to-end walkthrough
- how to think about research and future grading features
- how content type plugins differ from activity plugins
- how to expose course content resources, settings forms, routes, and embedding source descriptors

## Quick Orientation

Cognelo is a monorepo with two apps and several shared packages:

```text
apps/
  api/      Next.js backend API
  web/      Next.js frontend
packages/
  activity-sdk/   plugin registry and contracts
  activity-ui/    shared code editor and renderer
  content-type-sdk/
                  content type plugin registry and contracts
  core/           shared business logic
  contracts/      Zod schemas and shared types
  db/             Prisma schema, migrations, seed
  plugin-activities/
                  activity plugin packages
  plugin-content-types/
                  content type plugin packages
```

The main idea is simple:

- the platform owns generic auth, subject, activity-bank, course, section/group, content tree, resource, activity-copy, and dispatcher infrastructure
- activity plugins own activity-specific behavior
- content type plugins own non-activity content behavior

## Fast Answer

If you just want the shortest possible summary:

1. Copy a plugin under `packages/plugin-activities/`
2. Rename its keys and package metadata
3. Register it in `packages/activity-sdk/src/index.ts`
4. If it has API subroutes, register it in `packages/activity-sdk/src/server.ts`
5. If it has a custom UI, register it in `apps/web/src/lib/activity-renderers.tsx`
6. If it needs persistence, add a plugin-local Prisma schema, migrations, client wrapper, and database manifest
7. Seed or sync its `ActivityPluginInstallation` manifest so admins can activate it and then enable or disable it from Settings
8. If it exposes any authoring or settings form, register that form with `useUnsavedChangesGuard` from `@cognelo/activity-ui`
9. If it has private bank-owned data, add a server hook to copy it into course-owned plugin tables when assigned. This is required for correct copy semantics.
10. Do not implement or hide activity-to-knowledge-concept selection in the plugin. The host application supplies the mandatory Concepts tab to every activity authoring page and core owns its versioned links.

For a content type plugin:

1. Create `packages/plugin-content-types/plugin-your-content-type`
2. Export a `ContentTypePlugin`
3. Register it in `packages/content-type-sdk/src/index.ts`
4. Export a `ServerContentTypePlugin`
5. Register it in `packages/content-type-sdk/src/server.ts`
6. Register any settings/viewer renderer in `apps/web/src/lib/content-type-renderers.tsx`
7. Implement `getEmbeddingSource` so future indexing can read a generic descriptor
8. Add plugin-owned tables only when generic `CourseContentResource.metadata` is not enough

The rest of this handbook explains each step carefully.

Next:

- Experienced developer: [Plugin Authoring Quick Reference](00-quick-reference.md)
- Beginner path: [Cognelo And Next.js Basics](01-basics.md)
