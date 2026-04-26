# Data, Research, And Grading

Back to the [handbook index](README.md)

This chapter explains how to think about plugin data, especially if you care about analytics, educational research, or future grading workflows.

## Two Kinds Of Plugin Data

In practice, plugin data usually falls into two buckets:

1. low-volume configuration and metadata
2. high-volume operational or learner data

## `config` Vs `metadata`

Every bank activity, activity version, and course activity already has:

- `config`
- `metadata`

Use `config` for things that change how the activity behaves.

Examples:

- the prompt
- starter code
- allowed language
- number of attempts
- hint policy

Use `metadata` for things that describe the activity from an analysis or operational perspective.

Examples:

- research tags
- instrumentation enabled
- experiment condition
- cohort name
- analysis labels

Good rule:

- if a learner would experience the change directly, it is probably `config`
- if a researcher or administrator would use the value to group or analyze activities, it is probably `metadata`
- if the value is private, such as hidden tests or reference solutions, it belongs in plugin-owned tables rather than public `config`

## Plugin-Owned Tables

When data gets larger, more detailed, or more activity-specific, create plugin-owned tables.

Examples:

- one row per attempt
- one row per submission
- one row per grading event
- one row per hint request
- one row per telemetry event

Parsons already uses this model with plugin-specific attempt tables.

Some plugins need both bank-owned and course-owned plugin tables. For example, a reusable bank activity may have private reference data, and assigning it to a course should copy that private data into course-owned plugin tables. Use server plugin hooks for that copy step so later bank edits do not mutate existing course activities.

## Why Research-Friendly Design Matters

Cognelo already leans toward research-friendly activity architecture.

That is visible in the current codebase through:

- generic `metadata` fields
- seeded research-related metadata
- plugin-specific attempt/event storage in Parsons

If you design your plugin data carefully, you make future analysis much easier.

## A Practical Research Pattern

A good pattern is:

- store reusable labels and conditions on `BankActivity.metadata` or `ActivityVersion.metadata`
- copy labels into `Activity.metadata` when the course needs a local snapshot
- store event-level traces in plugin tables
- store rollup summaries in plugin tables or summary JSON fields

Example:

- `Activity.metadata.condition = "worked-example"`
- `PluginTracingQuizEvent` stores each learner action
- `PluginTracingQuizSubmission.resultSummary` stores the latest score or evaluation summary

## Current State Of Grading

There is not yet a platform-wide gradebook service in Cognelo.

The `plugin-homework-grader` package currently acts more like a scaffold than a finished grading system.

Today, if a plugin needs grading behavior, the plugin should own it.

That might include:

- submission tables
- grading tables
- rubric snapshots
- instructor feedback storage
- score summaries

## How To Design For Future Shared Grading

Even though shared grading is not implemented yet, you can prepare for it.

Useful design habits:

- always link grading data to `activityId` and `userId`
- separate raw attempts from final grades
- store timestamps clearly
- keep result summaries structured
- version rubrics or grading modes when possible

That way, if Cognelo later grows a shared gradebook, your plugin data will be easier to migrate.

## Example Metadata Schema

```ts
metadataSchema: z.object({
  researchTags: z.array(z.string()).default([]),
  instrumented: z.boolean().default(false),
  cohort: z.string().optional(),
  condition: z.enum(["control", "hinted", "worked-example"]).optional()
})
```

## Example Plugin Table

```prisma
model PluginTracingQuizSubmission {
  id           String   @id @default(cuid())
  activityId   String
  userId       String
  answer       String
  resultSummary Json    @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  activity Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Beginner Tip

When in doubt, start simpler:

- put stable analysis labels in `metadata`
- only add plugin tables when you truly need per-attempt or per-event storage

You can always add richer persistence later, but cleaning up a messy data model is harder.

Previous: [Build Your First Plugin](05-build-your-first-plugin.md)

Next: [Checklist And Reference](06-checklist-and-reference.md)
