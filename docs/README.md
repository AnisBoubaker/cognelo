# Cognelo Documentation

This is the routing page for repository-maintained documentation. Read the small orientation files first, then load only the topic that matches the work. A link is not an instruction to read every linked document.

## Always-Read Orientation

- [Root README](../README.md): project entry point, quick start, and commands.
- [Architecture](ARCHITECTURE.md): stable boundaries and repository layout.
- [Project memory](PROJECT_MEMORY.md): cross-cutting invariants and traps.

## Detailed Platform Reference

- [Platform details](reference/PLATFORM_DETAILS.md): exhaustive current feature, API, data-model, seed, development, deployment-summary, and frontend notes formerly kept in the root README. Search or open the relevant section; do not load it by default.
- [Detailed platform decisions](reference/PLATFORM_DECISIONS.md): expanded decisions and implementation constraints formerly kept in project memory. Read only relevant sections.
- [Application timezone and server time](APPLICATION_TIME.md): admin default, optional owner-managed course zones, scheduling conversion, server-clock enforcement, and regression checks.
- [Action buttons and icons](ACTION_BUTTONS.md): shared appearance, semantic icons, interaction states, and regression coverage.
- [Dialog headers and dismissal](DIALOGS.md): persistent close controls, compact review actions, app-wide coverage, and dismissal semantics.
- [Code editor undo and saved answers](EDITOR_UNDO.md): in-memory history isolation, saved-answer baselines, model disposal, and autosave regression checks.
- [Email delivery and test recipients](EMAIL_DELIVERY.md): outbound mail boundary and private local capture for synthetic recipients.
- [Text material editor and display](../packages/plugin-content-types/plugin-text/docs/REFERENCE.md): full Markdown authoring, display modes, and material image access.
- [Rich-text media](MEDIA_ASSETS.md): media assets, references, lifecycle, and garbage collection.
- [Browser user flows](../tests/e2e/README.md): E2E coverage, prerequisites, and failure policy.

## Plugin Development

- [Plugin authoring entry point](PLUGIN_AUTHORING.md)
- [Plugin authoring handbook](plugin-authoring/README.md)

For a specific plugin, begin with its package README and `PROJECT_MEMORY.md`. Those short files route to detailed references for authoring, persistence, execution, grading, or operations.

Activity plugin entry points:

- [Programming Exercises](../packages/plugin-activities/plugin-coding-exercises/README.md)
- [Coding Homework Grader](../packages/plugin-activities/plugin-coding-homework-grader/README.md)
- [MCQ](../packages/plugin-activities/plugin-mcq/README.md)
- [Parsons](../packages/plugin-activities/plugin-parsons/README.md)
- [Web Design Coding Exercises](../packages/plugin-activities/plugin-web-design-coding-exercises/README.md)
- [Placeholder](../packages/plugin-activities/plugin-placeholder/README.md)

Content-type plugin entry points live under `packages/plugin-content-types/`; their documents are already small and topic-specific. See [Link content](../packages/plugin-content-types/plugin-link/README.md) for described web links and configurable new-tab navigation.

## Feature Designs And Implementation State

Open these only when changing or reviewing the named area:

- [AI feedback, grading, and challenges](AI_FEEDBACK_GRADING_CHALLENGES_IMPLEMENTATION_PLAN.md)
- [Coding Homework Grader](CODING_HOMEWORK_GRADER_IMPLEMENTATION_PLAN.md)
- [Content-type plugins](CONTENT_TYPE_PLUGIN_IMPLEMENTATION_PLAN.md)
- [Course content tree](COURSE_CONTENT_TREE_IMPLEMENTATION_PLAN.md)
- [Reopening student submissions](SUBMISSION_CONTINUATION.md)
- [Gradebook](GRADEBOOK_IMPLEMENTATION_PLAN.md)
- [Student answer PDF/ZIP exports](ANSWER_EXPORTS.md)
- [Role authorization and multi-teacher E2E plan](ROLE_AUTHORIZATION_E2E_IMPLEMENTATION_PLAN.md)
- [Student groupings and teams](STUDENT_GROUPINGS.md)
- [Activity assignment exceptions and live settings](ACTIVITY_ASSIGNMENT_EXCEPTIONS.md)
- [Activity messaging](ACTIVITY_MESSAGING.md)
- [Student solution release](ACTIVITY_SOLUTIONS.md)
- [Activity content access after attempts end](ACTIVITY_CONTENT_ACCESS.md)
- [Live question edits, audit, and grade privacy](LIVE_ACTIVITY_AUTHORING.md)
- [Student model](STUDENT_MODEL_IMPLEMENTATION_PLAN.md)
- [Student view](STUDENT_VIEW_IMPLEMENTATION_PLAN.md)
- [Compound Test activity](TEST_COMPOUND_ACTIVITY_IMPLEMENTATION_PLAN.md)
- [Edit action bar rollout inventory](EDIT_ACTION_BAR_ROLLOUT_INVENTORY.md)
- [Security boundaries](SECURITY_BOUNDARIES.md): access, request/upload/export limits, authentication, rendering, credentials, sandboxing, and upgrade requirements.
- [Security remediation tracker](SECURITY_REMEDIATION_TRACKER.md) (local, ignored): defensive review status; private evidence remains outside the repository.

Implementation plans contain design rationale and delivery state. They are not required reading for unrelated work.

## Operations

- [Initial Ubuntu/Apache deployment](DEPLOYMENT_UBUNTU_APACHE.md)
- [Upgrade and rollback](DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md)
- [Release notes template](RELEASE_NOTES_TEMPLATE.md)

## Point-In-Time Records

- [Live activity settings verification — 2026-10-12](LIVE_ACTIVITY_SETTINGS_VERIFICATION_2026-10-12.md)
- [Automatic assignment and team-choice verification — 2026-10-12](TEAM_CHOICE_VERIFICATION_2026-10-12.md)
- [Activity exception verification — 2026-10-12](ACTIVITY_EXCEPTIONS_VERIFICATION_2026-10-12.md)
- [Grouping verification — 2026-10-12](E2E_RUN_2026-10-12.md)
- [E2E run — 2026-09-07](E2E_RUN_2026-09-07.md)

Point-in-time records preserve evidence; they are not current product reference unless explicitly linked from an active issue or task.

## Document Ownership Rules

- Root `README.md`: orientation, setup, commands, and links only.
- Root `docs/PROJECT_MEMORY.md`: short cross-cutting invariants only.
- `docs/reference/`: detailed searchable platform reference that is not loaded by default.
- Implementation plans: feature rationale, phases, status, and deferred decisions.
- Plugin README: concise purpose, capabilities, package map, and links.
- Plugin `PROJECT_MEMORY.md`: only non-obvious invariants and failure-prone decisions.
- Plugin `docs/`: detailed behavior grouped by subject.
- Deployment docs: executable operational procedures; do not summarize steps elsewhere.

Prefer one canonical owner and links over copied paragraphs. When moving information, update inbound links and leave no second normative version.
