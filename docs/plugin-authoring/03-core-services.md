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

Explicit synchronization uses that same hook to replace course-owned private authoring data during bank retrieval. Plugins whose course copies have private editable authoring data must also implement `ServerActivityPlugin.hooks.onCourseActivityPublishedToBank` to replace bank-owned authoring rows. Core blocks retrieval after any attempt. Course-to-bank publication remains allowed after attempts: core creates the new immutable version and checks bank write access, while plugins publish only authoring data and must never publish attempts, submissions, grades, or course-only runtime artifacts.

Core also provides bank-version comparison for all immutable generic activity fields. Plugin authors receive recursive config/metadata diffs automatically and should keep student-safe authoring configuration structured and stable where practical. Private plugin tables cannot appear in historical comparisons unless the platform later adds per-version private snapshots; do not query current private rows and present them as historical version data.

Core only creates the generic course-local `Activity` row and copies selected `ActivityVersion` fields. It does not know the schema or semantics of plugin-owned tables. If your plugin has bank-owned private rows, the hook is required. The hook should create independent course-owned rows keyed by the new `activity.id`, so future bank edits do not alter existing course activities.

Plugins that store private bank-owned data must also use `ServerActivityPlugin.hooks.onBankActivityDeleted` to remove bank-owned private rows when a bank activity is deleted. This cleanup must leave copied course-owned rows alone, because existing course activities become course-local copies after their bank links are cleared.

### Live authoring and learner grading state

Use `withActivityAuthoringChange` for course-private authoring writes, executing private SQL through its supplied transaction so validation, active-student confirmation, notice, and audit remain coordinated with the parent Test. Full private revisions stay in plugin tables; core receives only fingerprints. `ActivityDefinition.reconcileResponseState` preserves responses after configuration edits, and `studentResponseState` strips evaluation from generic learner drafts/history. A composite submission may return `gradingResult: null` for successfully submitted work awaiting grading. Assigned summative result/status/history routes must use `canShowStudentActivityGrade` before returning scores or grading evidence; hiding only the UI is insufficient. See [Live activity authoring](../LIVE_ACTIVITY_AUTHORING.md).

## Plugin Route Dispatch

The shared plugin route system lives in:

- [packages/activity-sdk/src/server.ts](../../packages/activity-sdk/src/server.ts)

and is consumed by the API route:

- [apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/activities/[activityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/activity-banks/[activityBankId]/activities/[bankActivityId]/[...pluginPath]/route.ts)
- [apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts](../../apps/api/src/app/api/courses/[courseId]/groups/[groupId]/activities/assigned/[activityId]/[...pluginPath]/route.ts)

What this gives you:

- auth is already enforced
- course activity routes require course-management permission by default; a safe method may declare `courseAuthorization: { GET: "view_gradebook" }` when section-scoped graders need it
- activity-bank routes require bank-management permission
- assigned section/group routes validate access to the concrete assignment
- the activity is already loaded
- the route is matched by activity type and path
- your handler receives a clean context object

Route matching is fail-closed: every `PluginRouteDefinition` must explicitly list `activityTypeKeys`. Omitting that list makes the route undispatchable. The host reads the route's declarative authorization before loading the activity, so it never hardcodes plugin paths. Handlers must still enforce operation-specific rules, such as requiring a student participant for submission or constraining a grader to authorized sections.

Cookie-authenticated unsafe requests are protected centrally by an exact `Origin`/`CORS_ORIGIN` match, including JSON and multipart plugin mutations. Do not bypass the generic dispatcher or invent a weaker plugin-local CORS/CSRF path.

Assigned summative activities may require Safe Exam Browser. The host assigned-activity dispatcher validates the activity-scoped SEB access session before resolving or invoking plugin code, and the shared draft/Test/submission/media routes do the same. Plugins should continue registering normal assigned routes and first-party media through the shared media service, and must not inspect SEB user-agent strings, Config Keys, or cookies themselves. A plugin route mounted outside the shared assigned dispatcher would need an equivalent host-level access check and therefore requires a platform review.

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
- [packages/activity-ui/src/rich-text-editor.tsx](../../packages/activity-ui/src/rich-text-editor.tsx)
- [packages/activity-ui/src/notifications.tsx](../../packages/activity-ui/src/notifications.tsx)
- [packages/activity-ui/src/help-tooltip.tsx](../../packages/activity-ui/src/help-tooltip.tsx)
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
- one sanitizer boundary; raw HTML is escaped except a fixed set of attribute-free formatting tags
- authored styles, forms, IDs/classes, and attributes remain inert; ordinary Markdown links/images/tables keep their renderer-owned markup
- untrusted KaTeX with bounded size/macro expansion; plugins must not enable trusted HTML commands or bypass this boundary

Older attributed HTML is displayed literally without changing stored source. Use ordinary Markdown/editor formatting. See [security boundaries](../SECURITY_BOUNDARIES.md) for the complete contract.

### What `RichTextEditor` Gives You

- one canonical Markdown value with Visual and source modes
- inline/display equation building and protected KaTeX widgets
- portable GFM table creation and row/column controls
- authenticated PNG, JPEG, GIF, and WebP upload with required alternative text and pixel, intrinsic-percentage, or container-percentage sizing
- click-to-edit image replacement, metadata updates, and removal
- one resizable height shared by both modes plus full-screen authoring

The default image uploader stores a first-party `/api/media-assets/<id>/content` URL. Core automatically reconciles references for generic Subject descriptions and Activity/BankActivity/ActivityVersion descriptions and config, including copy, version, synchronization, and immutable Test snapshot paths. If a plugin stores the editor value only in a plugin-owned table, it must add a durable media owner/reference integration before exposing image upload; rendering the URL alone is not enough to protect the bytes from garbage collection. See [Rich-text media assets](../../docs/MEDIA_ASSETS.md).

### What `useNotifications()` Gives You

- shared bottom-right snackbar-style notifications
- a single pattern for success, error, and informational messages
- reuse across core forms and plugin UIs without each plugin inventing its own save banner

Use this for transient confirmations and non-field-specific errors.

Prefer it over inline “saved” messages when the feedback does not need to stay attached to a specific form field.

### Contextual help in teacher interfaces

Use shared `HelpLabel` for background explanations in teacher pages and activity editors instead of permanently displayed helper paragraphs. It places a circled question mark **after the heading or native label on the same row**, outside its accessible name. Keep the input outside this row and preserve its `id`/`htmlFor` association:

```tsx
<div className="field">
  <HelpLabel help={t("candidateLimitHelp")}>
    <label htmlFor={candidateLimitId}>{t("candidateLimit")}</label>
  </HelpLabel>
  <input id={candidateLimitId} type="number" value={limit} onChange={updateLimit} />
</div>
```

Import `HelpLabel`/`HelpTooltip` from `@cognelo/activity-ui`. Core supplies the localized `HelpProvider`. Hover/focus opens help, click/tap pins it, and Escape/outside interaction dismisses it without submitting or closing its parent dialog. Help is portaled and bounded to the viewport. For custom label rows, append `HelpTooltip` after the text. `ToggleSwitch.help`, `AiModelPicker.connectionHelp`/`modelHelp` and `ConfirmationDialog.titleHelp` use the same primitive. Keep help accessible when its associated setting is disabled; native disabled fieldsets require placing it in the first legend.

Keep user-authored content, current results, required confirmations and learner task instructions visible. Errors and warnings use the existing notification system, never tooltips. Routine date fields use the effective timezone without repeating its name; show timezone names only in the actual configuration chooser. See [contextual help](../CONTEXTUAL_HELP.md).

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
  RichTextEditor,
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
      <RichTextEditor value={"## Editable prompt"} onChange={() => undefined} />
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

### Student Response Drafts And Execution State Hosts

Interactive learner renderers should receive an `ActivityExecutionStateHost` instead of keeping unfinished work only in component state. For standalone assigned activities, the web registry can create a serialized host with `createStandaloneActivityDraftHost`; it loads and saves bounded JSON through the core `ActivityResponseDraft` route without starting a gradebook attempt. Call the optional `clear()` only after a successful final submission. Plugins with richer attempt/event semantics, such as Parsons, may continue to own their specialized persisted draft model.

The same renderer may receive a different host inside a compound Test. Test children must use the injected Test host, which autosaves into `TestItemAttempt` under the parent attempt. Never call the standalone draft route from a Test child, and never replace the Test host with a standalone host. For the final Test answer-review screen, export a pure plugin-owned response-presence check and register it in `apps/web/src/lib/test-item-answer-status.ts` beside the embedded renderer registry. Inspect public config and saved student state only; do not grade, run tests, or reveal correctness. Automatically saved starter content must not count as a response.

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

## Security-sensitive request boundaries

Use the host-provided bounded `readJson`, and `readBoundedFormData` for multipart uploads. Do not parse an unbounded request stream inside a plugin. Declaring an expired final-submission method also requires `expiredAttemptInput`: it must reconstruct the final input from saved server data, never the incoming late body. The host rechecks time after reading the body and fails closed when the callback is absent. See [Security boundaries](../SECURITY_BOUNDARIES.md).

### Deferred assessment preparation

An activity definition may opt into `assessmentFlow: "deferred"` and mark individual trusted routes with `learnerAccessPhase: "preparation"` or `"assessment_start"`. Preparation retains assignment/availability/content authorization while bypassing SEB and an unstarted answer timer. Assessment start retains SEB verification and must establish its own core attempt; the generic host start rejects deferred activities. Unmarked routes remain protected. The renderer requests host SEB access through `onAssessmentAccessRequested` and refreshes timing after successful start through `onAssessmentStarted`. Do not mark answer, grading, or unrestricted mutation routes as preparation.

### Ordered submission stages

Definitions may declare `submissionStages`, an ordered list of stable IDs and localized names including the first stage. Core derives the count, validates unique IDs/names and at most one `assessment` stage, and owns calendar deadlines, optional durations, supported late policy and General/section/team/student field-level inheritance. The effective calendar date is the earlier stage/overall Until date; stage duration further caps work. Both dates may be absent. The `submissionStages.configuration` server service may supply active IDs and legacy defaults without exposing private storage to core. Plugins own stage starts/completion/evidence and must pass the assessment-effective assignment into answering/finalization. Waiting between stages starts no answering clock. See [the full contract](../ACTIVITY_SUBMISSION_STAGES.md).

Stage policies also have independent `enabled` activation. Core starts new/copy placements inactive; omitted historic flags retain legacy defaults. `activeStageIds` describes the authored workflow, whereas activation decides when a learner may begin an active stage. Use shared `SubmissionStageWaiting` for disabled stage actions; preparation may remain available before final hand-in activation. Resume/save/finalize already-started attempts after closure without resetting their start or extending deadlines.

Optional `submissionStages.prepareActivation({ user, courseId, activityId })` preloads readiness outside the write transaction. `activationChanged` receives that private prepared value, aggregate configured activation, a neutral SQL transaction, `isEnabled({ groupId, userId, stageId })` resolving saved current enrollment/exception policy, and a transactional `enqueue` callback with optional `runAfter`. Core invokes it after assignment/exception writes, including section-specific assignment routes. Validate readiness, update only your own private data and release/hold pending jobs atomically; throwing rolls settings and queue changes back. Aggregate flags are useful for authoring locks; always use the per-student resolver when admitting individual jobs. Do not make provider calls, start a second transaction requiring an already-held lock, query another plugin, or treat activation as a new attempt. Frozen work/cancelled jobs must retain their identity and timing. Ordinary activity definitions without stages remain unchanged.

### Deferred submission management and finalization

An activity may advertise `submissionManagement.rendererKey` for its operational panel in the shared activity details report. The host resolves this through its renderer registry; the plugin owns pending submission data and staff actions. This includes preparation/generation workflows that have no core attempt yet.

`ServerActivityPlugin.timedFinalization` lets the owning plugin finalize server-saved work after core verifies expiry. Return true after handling it; false uses core's generic fallback for legacy/incomplete states. Recheck effective deadlines, ignore new answer content at expiry, and serialize with saves/cancellation. Internal `deleteActivitySubmission` replacement options are server-only: they may cancel a started attempt, withdraw its associated grade and grant one replacement after release without altering class-wide release.

Replacement permissions are core-owned metadata. Ordinary start, submit and grading metadata cannot set or overwrite `replacementAllowed` or `replacementOfAttemptId`; only the authorized cancellation path grants replacement.

### Plugin file responses

An authorized plugin route may return a native `Response` for files/streams. The API response helper preserves its body, MIME/content-disposition headers and status, then applies host CORS/no-store policy; do not JSON-stringify the Response object. Assigned activity delivery still runs the post-handler content-closure check and cancels a file stream if access closes before delivery. Use explicit safe MIME types and private-file authorization in the owning plugin.

### Reference and settings authoring tabs

Embedding consumers declare `ActivityDefinition.usesMaterialEmbeddings` and register a type-scoped `ServerActivityPlugin.materialReferences` adapter. The host supplies the entire Reference materials UI: tree/defaults, hidden labels, selection Save/Cancel, previews, readiness and cancellable preparation. Core owns the corresponding routes and course-wide embedding setting; content plugins still own extraction/refresh. The adapter exposes private selection/snapshot/lock persistence through the core transaction, never its own reference UI or sibling-plugin calls. Use `useActivityReferenceAuthoring` from activity-ui for dependent readiness and unsaved-state checks. See [shared activity references](../ACTIVITY_MATERIAL_REFERENCES.md) for the contract and migration.

`authoring.settingsTab` and `authoring.simulationTab` opt into host-owned mounted portal targets for plugin-specific controls. A plugin may implement a teacher-only simulation using saved authoring data, with no learner academic writes. The older `authoring.referenceMaterialsTab` portal remains for compatibility; new embedding consumers use the capability above. Bank editors omit course-specific panels. Portal progress dialogs to the document body so hidden source panels cannot hide progress/Cancel. Incidental refreshes must preserve local drafts.

### Team-capable activities

Advertise `ActivityDefinition.supportsTeamwork` and register `ServerActivityPlugin.teamwork` with matching `activityTypeKeys`. Core supplies the General toggle, per-section grouping/unteamed policy, authorized current-membership resolution and active-hand-in checks. `hasActiveSubmissions` must report pending, answering and completed hand-ins that must lock policy changes, including individual hand-ins before switching modes.

`membershipChanged` runs inside the host’s grouping transaction through a neutral parameterized `query`/`execute` adapter. It receives actual changed enrollments, previous/current teams, newly empty teams, the current section assignment, membership tokens/workspace epochs and a durable enqueue callback. Revoke private old participation, attach late joiners where appropriate, erase empty workspaces and return only related core attempt IDs for core to withdraw. Do not call AI/network services or mutate core grades from the plugin callback. Do physical cleanup after commit through durable jobs. Preserve private individual answers and core timers/grades even when files/questions are shared. See [team delivery](../TEAM_ACTIVITY_SUBMISSIONS.md) for lock order, persistence and lifecycle rules.

For deferred activities whose frozen work is complete without answering, core `recordDeferredActivitySubmission` records an ungraded completed attempt in the caller’s transaction. The neutral teamwork adapter exposes `recordDeferredSubmission` for late-member completion. These are trusted server capabilities after the plugin authorizes/freezes evidence, not public request flags; they preserve enrollment, attempt/release policy and create no timer. See [optional homework questions](../PROGRAMMING_HOMEWORK_EDITOR.md#completion-boundary).

For boolean options in activity editors, use `ToggleSwitch` from activity-ui with a label, locale, checked state and change callback. It uses native keyboard interaction and `role="switch"`, with shared On/Off styling. Keep native checkboxes for choosing items in lists and for explicit incomplete-work acknowledgement. Do not replace activity-owned Save/Cancel or server-side setting locks with optimistic presentation alone.

A deferred activity may declare top-level config `preparationMediaFields` for student-facing assignment Markdown. Core permits only images actually referenced in those exact fields before SEB answering, retaining enrollment/publication/visibility/content-closure checks. Do not list private assessment/question fields; all other activity media retains the usual SEB gate.
