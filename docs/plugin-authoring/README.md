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

## Fast Paths

- Experienced developer: [Plugin Authoring Quick Reference](00-quick-reference.md)
- Beginner path: start below and read in order

## Reading Path

1. [Cognelo And Next.js Basics](01-basics.md)
2. [Bootstrap A Plugin](02-bootstrap.md)
3. [Core Services You Can Reuse](03-core-services.md)
4. [Build A Real Plugin](04-building-a-plugin.md)
5. [Build Your First Plugin](05-build-your-first-plugin.md)
6. [Data, Research, And Grading](05-data-research-and-grading.md)
7. [Checklist And Reference](06-checklist-and-reference.md)

## What This Handbook Covers

- what a plugin is in Cognelo
- how the API app and web app fit together
- where plugin code belongs
- how to reuse the shared code editor and renderer
- how to register a plugin
- how to add plugin-specific UI, routes, and storage
- how to follow a complete end-to-end walkthrough
- how to think about research and future grading features

## Quick Orientation

Cognelo is a monorepo with two apps and several shared packages:

```text
apps/
  api/      Next.js backend API
  web/      Next.js frontend
packages/
  activity-sdk/   plugin registry and contracts
  activity-ui/    shared code editor and renderer
  core/           shared business logic
  contracts/      Zod schemas and shared types
  db/             Prisma schema, migrations, seed
  plugins/        plugin packages
```

The main idea is simple:

- the platform owns generic auth, subject, activity-bank, course, section/group, activity-copy, and dispatcher infrastructure
- each plugin owns activity-specific behavior

## Fast Answer

If you just want the shortest possible summary:

1. Copy a plugin under `packages/plugins/`
2. Rename its keys and package metadata
3. Register it in `packages/activity-sdk/src/index.ts`
4. If it has API subroutes, register it in `packages/activity-sdk/src/server.ts`
5. If it has a custom UI, register it in `apps/web/src/lib/activity-renderers.tsx`
6. If it needs persistence, add Prisma models in `packages/db/prisma/schema.prisma`
7. If it has private bank-owned data, add a server hook to copy it into course-owned plugin tables when assigned

The rest of this handbook explains each step carefully.

Next:

- Experienced developer: [Plugin Authoring Quick Reference](00-quick-reference.md)
- Beginner path: [Cognelo And Next.js Basics](01-basics.md)
