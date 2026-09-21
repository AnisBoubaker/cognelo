# Project Memory

This file is intentionally short. It records only cross-cutting decisions that are easy to violate and should be loaded for every task. Use the [documentation index](README.md) to open detailed references only when the task needs them.

## Platform Invariants

- Keep `apps/api` and `apps/web` separate. Shared business rules belong in `packages/core`; shared schemas belong in `packages/contracts`.
- Keep core persistence generic. Activity- or content-type-specific tables, migrations, routes, services, translations, and UI belong to the owning plugin.
- Treat browser-visible activity config as public student data. Hidden tests, reference solutions, raw model output, private prompts, credentials, and grading internals stay server-side in authorized storage and routes.
- Plugin dispatch is explicit and fail-closed. A route must declare supported type keys, and authorization must be checked for its course, bank, group, or content-resource context.
- Bank activities are reusable authoring sources; course activities are independent copies. Changed Published saves create immutable generic versions. Bank-to-course retrieval is blocked after any attempt, while course-to-bank publication may create a new bank version without modifying attempted course content.
- Plugins with private bank-owned data must implement every relevant copy, synchronization, duplication, deletion, activation, backup, and restoration hook. Moving a bank activity keeps its ID and normally requires no copy.
- Core owns attempts, attempt limits, gradebook lifecycle, release visibility, audited regrades, research events, and grade challenges. Plugins own activity-specific evaluation and sanitized feedback contracts.
- Summative model evaluation is teacher-triggered unless a feature explicitly documents another policy. Formative feedback may run from the learner's explicit check or submit action. Learner copy must not reveal the grading mechanism.
- Research and audit records are append-oriented. Preserve immutable request/configuration snapshots, provenance, event history, and release visibility; do not silently rewrite historical evidence.
- Shared authoring forms use the common unsaved-change guard and `EditActionBar`. Activity concept selection is host-owned and shares the activity draft/save boundary.
- Reuse the shared editor, Markdown, rich-text, media, dialog, notification, and icon layers instead of creating plugin-local alternatives for platform behavior.
- User-facing text is localized. Subject teaching language—not the viewer locale—controls generated curriculum, rubric, and assessment-feedback language where documented.
- Cookie-authenticated mutations enforce the configured browser origin. External execution services such as Judge0 and Playwright remain behind Cognelo server routes.
- Production schema changes require additive/idempotent migrations where possible, a fresh production-clone rehearsal, backups, explicit approval, smoke tests, and a documented rollback path.

## Where Details Live

- Architecture and repository boundaries: [ARCHITECTURE.md](ARCHITECTURE.md)
- Full platform behavior and endpoint inventory: [reference/PLATFORM_DETAILS.md](reference/PLATFORM_DETAILS.md)
- Expanded decisions, constraints, fixtures, and verification notes: [reference/PLATFORM_DECISIONS.md](reference/PLATFORM_DECISIONS.md)
- AI feedback, grading, research, and challenges: [AI_FEEDBACK_GRADING_CHALLENGES_IMPLEMENTATION_PLAN.md](AI_FEEDBACK_GRADING_CHALLENGES_IMPLEMENTATION_PLAN.md)
- Gradebook lifecycle: [GRADEBOOK_IMPLEMENTATION_PLAN.md](GRADEBOOK_IMPLEMENTATION_PLAN.md)
- Course content tree: [COURSE_CONTENT_TREE_IMPLEMENTATION_PLAN.md](COURSE_CONTENT_TREE_IMPLEMENTATION_PLAN.md)
- Plugin contracts and tutorials: [plugin-authoring/README.md](plugin-authoring/README.md)
- Deployment and release gates: [DEPLOYMENT_UBUNTU_APACHE.md](DEPLOYMENT_UBUNTU_APACHE.md) and [DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md](DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md)

Plugin-specific decisions live in the owning plugin's README, short `PROJECT_MEMORY.md`, and linked detailed references. Do not copy them back into this file unless they establish a platform-wide contract.
