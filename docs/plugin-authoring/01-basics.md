# Cognelo And Next.js Basics

Back to the [handbook index](README.md)

This chapter explains the pieces you need to understand before writing a plugin.

## What Is A Plugin In Cognelo?

In Cognelo, a plugin is a package that adds one or more activity types.

An activity type is something like:

- a Parsons problem
- a homework grader
- a tracing quiz
- a code-completion exercise

The plugin package provides the activity-specific behavior. The platform provides the generic plumbing around it.

## What Does The Platform Already Do?

The platform already handles:

- login and current-user lookup
- subject, activity-bank, course, section/group, and activity storage
- authorization
- activity-bank authoring, course activity copy creation, and activity update flows
- plugin route dispatch
- shared code editing and syntax highlighting

This is important for beginners because it means you do not start from zero. You are plugging into an existing application, not building a whole app from scratch.

## Why Two Next.js Apps?

Cognelo has:

- `apps/web`: the frontend app users see in the browser
- `apps/api`: the backend API app that serves JSON endpoints

Both are built with Next.js.

That means you can stay in one ecosystem:

- React components for UI
- route handlers for API endpoints
- shared TypeScript types across both apps

## Where Plugins Fit

Plugins themselves live in:

```text
packages/plugins/
```

The plugin package is not a standalone app. Instead, it gets imported by the main platform.

The main registration points are:

- `packages/activity-sdk/src/index.ts`
- `packages/activity-sdk/src/server.ts`
- `apps/web/src/lib/activity-renderers.tsx`

## The Most Important Idea: Shared Vs Plugin-Specific

When designing a plugin, ask:

"Is this concept shared across many activity types, or is it specific to my plugin?"

Examples of shared platform concerns:

- user identity
- course membership and section/group participation
- activity-bank ownership
- generic activity records
- activity version provenance
- generic activity metadata

Examples of plugin-specific concerns:

- Parsons attempt ordering
- grading events for a homework plugin
- hint usage in a tracing plugin
- custom submission workflows

As a rule:

- shared concerns belong in `packages/core`, `packages/contracts`, `packages/db`, or shared apps
- plugin-specific concerns belong inside the plugin package

## What Happens When A User Opens An Activity Page?

There are three common activity contexts:

- activity-bank authoring: [apps/web/src/app/activity-banks/[activityBankId]/activities/[bankActivityId]/page.tsx](../../apps/web/src/app/activity-banks/[activityBankId]/activities/[bankActivityId]/page.tsx)
- course teacher authoring: [apps/web/src/app/courses/[courseId]/activities/[activityId]/page.tsx](../../apps/web/src/app/courses/[courseId]/activities/[activityId]/page.tsx)
- section/group assigned activity work: [apps/web/src/app/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/page.tsx](../../apps/web/src/app/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/page.tsx)

At a high level, it:

1. loads the surrounding context
2. loads the activity or bank activity
3. finds the renderer for that activity type
4. renders the matching plugin UI

That renderer lookup happens in:

- [apps/web/src/lib/activity-renderers.tsx](../../apps/web/src/lib/activity-renderers.tsx)

This is why frontend plugins must be registered there.

## What Happens When A Plugin Needs A Custom API Endpoint?

The API app has a generic dispatcher route:

- [apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts)

This route:

- authenticates the user
- loads the activity
- finds a registered plugin route
- calls the plugin handler

So beginners do not need to create a brand-new top-level API route for every plugin feature. You define plugin route definitions and let the platform dispatch them.

## How Activity Banks Relate To Courses

Activity banks are reusable authoring spaces. A bank activity has versions. When a teacher adds a bank activity to a course, Cognelo copies the selected/latest version into a course-local activity.

After copying:

- course edits affect only the course activity copy
- bank edits create a new version for future assignments
- existing course copies do not change
- plugins can copy private bank-owned data into course-owned plugin tables with a server hook

## Where Validation Happens

Shared request shapes live in:

- [packages/contracts/src/index.ts](../../packages/contracts/src/index.ts)

Plugin-specific config validation happens through:

- `configSchema`
- `metadataSchema`

The core activity service applies these during create and update in:

- [packages/core/src/activities.ts](../../packages/core/src/activities.ts)

This means plugin authors usually validate:

- config values
- metadata values
- plugin route payloads

using Zod.

## A Mental Model For New Next.js Developers

If you are new to Next.js, think of Cognelo like this:

- `apps/web` is your React app
- `apps/api` is your server API
- `packages/*` are shared libraries
- `packages/plugins/*` are feature modules

You do not need to know every Next.js feature to work on a plugin. For most plugin work, you mainly need:

- React components
- route handlers
- imports between packages
- async data fetching

## Beginner Tip

Before starting your own plugin, open these three files and skim them:

- [packages/plugins/plugin-placeholder/src/index.ts](../../packages/plugins/plugin-placeholder/src/index.ts)
- [packages/plugins/plugin-homework-grader/src/index.ts](../../packages/plugins/plugin-homework-grader/src/index.ts)
- [packages/plugins/plugin-parsons/src/plugin.ts](../../packages/plugins/plugin-parsons/src/plugin.ts)

They show the progression from simple to advanced.

Next: [Bootstrap A Plugin](02-bootstrap.md)
