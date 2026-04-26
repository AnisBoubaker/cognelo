# Checklist And Reference

Back to the [handbook index](README.md)

This chapter is the practical final page: what to check, what to run, and what files to study.

## Beginner-Friendly Build Checklist

When creating a new plugin, a safe order is:

1. create the package
2. define the plugin object
3. register it in `packages/activity-sdk/src/index.ts`
4. add a simple renderer
5. register the renderer
6. verify the activity type appears
7. add routes if needed
8. add persistence if needed
9. add a bank-to-course copy hook if the plugin owns private bank data
10. add docs

## Commands

Always useful:

```bash
npm run typecheck
```

If you changed Prisma schema:

```bash
npm run db:generate
npm run db:migrate
```

If you changed seed behavior:

```bash
npm run db:seed
```

If you changed UI behavior:

```bash
npm run dev
```

## Manual Verification

Check that:

- the plugin appears in `/api/activity-types`
- a new activity can be created
- a bank activity can be authored if the plugin supports teacher authoring
- assigning from an activity bank creates an independent course copy
- the activity renders your component
- saving config works
- bank edits do not mutate existing course copies
- invalid config is rejected
- plugin routes respond correctly
- unauthorized access is rejected
- any plugin tables receive the expected records

## Best Reference Files

Read these when you get stuck:

- [packages/activity-sdk/src/index.ts](../../packages/activity-sdk/src/index.ts)
- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)
- [packages/core/src/activities.ts](../../packages/core/src/activities.ts)
- [packages/core/src/subjects.ts](../../packages/core/src/subjects.ts)
- [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts)
- [packages/activity-ui/src/code-editor.tsx](../../packages/activity-ui/src/code-editor.tsx)
- [packages/activity-ui/src/code-renderer.tsx](../../packages/activity-ui/src/code-renderer.tsx)
- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)
- [apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
- [packages/plugins/plugin-placeholder/src/index.ts](../../packages/plugins/plugin-placeholder/src/index.ts)
- [packages/plugins/plugin-homework-grader/src/index.ts](../../packages/plugins/plugin-homework-grader/src/index.ts)
- [packages/plugins/plugin-parsons/src/plugin.ts](../../packages/plugins/plugin-parsons/src/plugin.ts)
- [packages/plugins/plugin-parsons/src/routes.ts](../../packages/plugins/plugin-parsons/src/routes.ts)
- [packages/plugins/plugin-parsons/src/db.ts](../../packages/plugins/plugin-parsons/src/db.ts)

## If You Want To Grow The Docs Later

The easiest next expansions would be:

- a dedicated “build a homework grader” tutorial
- a dedicated “research instrumentation patterns” page
- a dedicated “shared grading roadmap” page

For now, this handbook should be enough for a beginner to build a working plugin without first being an expert in Next.js.

Previous: [Data, Research, And Grading](05-data-research-and-grading.md)
