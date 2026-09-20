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

When data gets larger, more detailed, or more activity-specific, create plugin-owned tables through a plugin-local Prisma schema and client.

Examples:

- one row per attempt
- one row per submission
- one row per grading event
- one row per hint request
- one row per telemetry event

Parsons already uses this model with plugin-specific attempt tables.

Some plugins need both bank-owned and course-owned plugin tables. For example, a reusable bank activity may have private reference data, and assigning it to a course should copy that private data into course-owned plugin tables. Use server plugin hooks for that copy step so later bank edits do not mutate existing course activities.

This copy step is mandatory for bank-owned private data. Core copies only generic activity/version data. Plugin-owned tables must be copied by the plugin into course-owned rows keyed by the new course `activity.id`. When adding or changing plugin tables, include a manual verification path: author in a bank, publish, add to a course, and confirm the course activity has its own plugin-owned rows.

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

Cognelo has a shared gradebook lifecycle for assigned summative activities. Core owns `GradebookItem`, `ActivityAttempt`, selected `Grade`, append-only `GradeEvent`, attempt/release policy, late penalties, overrides, and student visibility. A plugin submits or grades through core services and keeps its activity-specific submission/result data in plugin-owned tables.

Useful design rules:

- always link plugin submission/evaluation data to `activityId`, the learner, and the core attempt when one exists;
- keep raw attempts separate from selected/final grades;
- store structured score components and timestamps;
- keep private submissions, hidden tests, rubrics, and unrestricted feedback artifacts in plugin-owned tables;
- return only normalized grading/feedback results to core;
- version rubrics, prompts, schemas, and model evaluations rather than overwriting them.

## AI Feedback And AI-Assisted Grading

AI assessment uses an explicit core/plugin boundary:

- the activity definition declares `supportsAiFeedback` and, only if applicable, `supportsAiFeedbackGrading`;
- the server plugin registers `aiFeedback.evaluateAttempt`;
- the activity definition registers `aiFeedback.rendererKey`, and the server plugin registers `aiFeedback.teacherReview.getSubmission`, `createFeedbackDraft`, and `reviseFeedback` so teachers can inspect the plugin-specific answer, author feedback without AI, or edit generated feedback;
- course settings must enable automatic feedback and select an accessible assessment-feedback AI connection;
- the plugin must reject enabled but incomplete activity configuration;
- formative feedback runs from the learner's explicit plugin check/submit route;
- summative feedback/grading runs only from the teacher-triggered gradebook route, never from submission or a background job;
- core hides summative feedback until grade release.

The handler returns an immutable `feedbackRef`, `feedbackVersion`, `feedbackHash`, sanitized feedback, and optionally a normal plugin grading result. Feedback-only plugins must omit the grading result. If AI affects the grade, core marks the released feedback challengeable; deterministic feedback such as MCQ explanations stays non-challengeable.

Teacher review is a required capability whenever a plugin declares AI feedback. The detailed gradebook exposes that form for every submitted attempt, not only attempts with generated feedback, and whole-group review navigates all submitted learners. The web renderer owns the plugin-specific answer and feedback form. `createFeedbackDraft` returns a valid plugin-owned draft; it may include the activity's configured rubric with initial editable scores even before automatic evaluation. `reviseFeedback` must whitelist editable fields and preserve stable rubric/question identities and grading policy. It returns validated feedback and may optionally return a `PluginGradingResult` when a plugin deliberately allows teacher rubric-score editing. Core stores pre-grade teacher feedback on the attempt and propagates it into a later grade; generated feedback takes precedence when a grading operation supplies it. It records `feedback_teacher_authored` for the first teacher save, `feedback_teacher_revised` for later edits, and previous/next audit snapshots. Optional rubric grade changes run through the ordinary gradebook regrade service, preserve deterministic components/configured weights, and record `feedback_teacher_grade_adjusted`. Generated feedback remains editable until that exact version is challenged; teacher-authored feedback is non-challengeable. Student product copy must describe feedback and grading without claiming that AI produced either result, and must omit empty narrative sections.

Store complete reproducibility artifacts privately in a plugin-owned evaluation table: the submission/config/rubric snapshot, provider and model, prompt/schema versions, raw response, parsed output, sanitized result, rubric and feedback hashes, latency, score components, and errors. Treat learner content as untrusted prompt input and use strict structured-output validation with bounded retries. Never put credentials, hidden tests, complete submissions, unrestricted prompts, or raw responses into the normalized core research stream or student DTOs.

Core `AiFeedbackResearchEvent` records bounded append-only lifecycle envelopes across plugins. Use the shared recorder for request/completion/failure and include stable identifiers, trigger kind, assessment mode, versions/hashes, contribution, and bounded metadata. Release, view, teacher revision, Test parent recomputation, and challenge events are recorded by core. The manager research route pseudonymizes participant, user, actor, and attempt identifiers by default; production research still requires approved consent filtering and retention/anonymization policy.

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
