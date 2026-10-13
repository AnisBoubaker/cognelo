# Browser user flows

The Playwright suite covers the platform's critical browser journeys with real API and database integration:

- anonymous access control, sign-in, first-time activation UI, and sign-out;
- unsaved authoring across Activity/Concepts tabs and navigation prompts, discard persistence, failed Save-and-leave recovery, and preservation of editable work through a network session-check failure;
- global administrator, course manager, teacher, and student boundaries; explicit multi-teacher course staffing; section-scoped teacher/TA grading, roster, release, and identifier-tampering boundaries; immediate partial/final revocation; final-owner protection; and preservation of academic history;
- personal settings, profile and password changes, email verification, forced password replacement, and fresh-session sign-in, plus administrator user creation, confirmation, filtering, and password reset;
- administrator AI-model CRUD and preference selection, retained email-secret handling and test-email progress, activity/content plugin lifecycle controls, and media-cleanup progress and results;
- installed plugin composition across real API route bundles and the course browser, including activity metadata/icons and coding-renderer mounting;
- teacher creation of subjects, activity banks, courses, groups, linked users, and pending participants, plus existing-account matching, CSV validation/import progress and totals, participant removal, and moving a learner between groups without breaking access;
- complete knowledge-graph concept, prerequisite, skill, and misconception editing and persistence, including stable activity targeting and mocked AI generation/iteration progress;
- course settings lifecycle for metadata, publication/archive restoration, and content-layout persistence;
- teacher Student view in a separate window, including the group-scoped learner projection, absence of Grades, temporary answer reset, real formative evaluation, and proof that no attempt/draft/grade record is created;
- nested course-content resource workflows for folders, rich text, GitHub links, exact-byte file download, drag-and-drop placement, duplication, inherited group visibility, ordinary deletion, blocked folder batches that name activities with attempts, and the separate individual activity data-loss warning;
- browser authoring, publication, course copying, assignment, and student completion for MCQ, Parsons, coding exercise, web-design coding exercise, and Coding Homework Grader activities;
- Programming Exercise test generation in Add and Replace modes, visible-only/hidden-only requests, rejection of an all-zero request, capacity checks, preserved existing cases despite repeated model IDs, full existing-test request context only in Add mode, and real save/reload persistence; partial results show a count warning and a later failed generation preserves the saved suite. These scenarios intercept model availability/output only and save through real Judge0 validation;
- authoring a core compound Test from reusable bank activities and completing its student assessment flow, plus authoring and publishing reusable bank Tests, preserving their owned activity copies after source deletion, importing their full graphs into courses, and publishing course-authored Tests back to a bank;
- the placeholder activity's intentional unsupported authoring and learner states;
- summative assignment policy, automatic learner-visible content materialization when a direct assignment omits placement, draft autosave and resume, multiple attempts, attempt limits, automatic grading, gradebook filtering, per-activity CSV/XLSX export from the gradebook and course-content menu, release/hide controls, and student grade visibility;
- reopening the latest submitted attempt from Student results and detailed gradebook, saved-answer restoration across all answering plugins and compound Tests, resubmission without a new attempt, and current extensions/student exceptions from the original start;
- partial-grade identification, exclusion from exports, publication blocking, and the valid no-submission release case;
- formative/summative conversion semantics, including the destructive-change confirmation, conversion of existing summative attempts, preservation of formative attempts after switching back, and separation of new summative attempts;
- opt-in summative grade challenges with General/per-group assignment policy, in-place teacher review and audited grade changes, teacher responses, resolved-item filtering, and open-before-resolved ordering;
- guided batch AI grading with up to three reviewed templates, instruction persistence, progress feedback, and exclusion of selected templates from regrading;
- consistent detailed-gradebook actions through the per-student three-dot contextual menu, including course-content entry into the two-tab activity report, its persistent editor action, lightweight live monitoring of in-progress attempts and their start times, automatic MCQ regrading, MCQ and Parsons review/override persistence, lazy newest-to-older attempt inspection, nested Test-item grading, and the Programming Exercise review surface that combines submitted work, rubric feedback, and the editable final grade;
- learner-visible Programming Exercise reports covering the automatic/rubric/total recap, teacher comments, rubric explanations, source attempts, and individual test outcomes and scores;
- shared accessible confirmation dialogs for grade release, AI assessment, participant removal, and other guarded actions instead of native browser popups;
- activity-settings dialog layout and the AI placeholder, Cancel behavior, formative/summative field filtering, generic General timing plus changed/disabled group overrides, Assign-to-all preservation, unassignment cleanup, inheritance and every group override category, save/reopen persistence, assigned/unassigned access, group visibility, upcoming and expired availability, Safe Exam Browser gating, and effective per-group gradebook policy;
- explicit timed starts and automatic zero-time submission for standalone activities, plus one-time Test-authoring default copy, independent later Test edits, and the compound Test countdown/finalization path;
- activity-level messaging settings with live enable/disable during timed, untimed, and compound Test attempts, preserved answers/history, cancellation, and default-off server enforcement;
- attempt-scoped live activity broadcasts, including recent-recipient detection, unread/read state, the combined timer-and-envelope control, and isolation of messages when the learner starts a later attempt;
- bank activity publication from the editor and list, version comparison, duplication, movement between banks, and AI-assisted variation progress for both individual activities and compound Tests, including midpoint failure cleanup and retry;
- explicit bank-to-course synchronization confirmation/cancellation, preservation of assignment and placement, immutable earlier versions, post-submission retrieval rejection, and course-to-bank publication without changing attempts or grades;
- on-demand gradebook summary loading, continued content-menu interaction while the gradebook request is pending, and desktop/mobile scroll and collapsed-folder preservation during slow content-settings refreshes and visibility changes;
- administrator-managed Judge0, web-design, and SageMath execution-runner endpoints, including per-endpoint capability checks; and
- group settings updates and restoration;
- English/French locale persistence across navigation and reload; and
- keyboard-only context-menu operation plus narrow-viewport containment for the course workspace and fixed menus.

Browser interactions use accessible roles, labels, and visible text. Direct structural selectors are limited to stable editor surfaces that cannot be uniquely addressed or verified through an accessible name. Teardown invokes the public activity and bank deletion routes first so plugin-private records receive their lifecycle hooks, then uses direct database access only as an exact-ID fallback for records created by that test run. Stateful tests provision disposable, currently available scenarios through authenticated public API routes because durable seed courses can legitimately have expired availability dates. The ZIP-upload path builds its fixture in memory instead of committing a binary archive.

## Run locally

Start from a migrated and seeded development database, then run:

```bash
npm run test:e2e
```

Install Playwright's bundled Chromium first when needed:

```bash
npm run test:e2e:install
```

To use an existing Chromium executable instead, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. `E2E_WEB_URL`, `E2E_API_URL`, and the `E2E_<ROLE>_EMAIL` / `E2E_<ROLE>_PASSWORD` variables can override the local defaults. The default accounts are the documented seeded admin, teacher, and student accounts.

The runner starts the API and web development servers when they are not already available, uses a single worker to protect shared development data, and writes reports, traces, and screenshots under ignored `tmp/` paths.

The broad activity suite exercises real plugin integrations. Coding exercise runs require Judge0, web-design runs require the Playwright runner, and Coding Homework challenge generation requires a configured question-authoring model plus the API background worker. Start those services and configure the model connection before running the complete suite.

## Test email

The shared API delivery boundary captures `cognelo.local` and reserved example/test recipients in the private `storage/email-outbox/` directory, even when the reused server has real SMTP or Graph configured. The account verification scenario reads the captured code and exercises the real send/verify APIs. A separate administrator scenario verifies capture through the actual test-email endpoint. The email-settings progress/secret-retention scenario still intercepts its settings requests to avoid changing the instance configuration.

Outbox assertions require local access to the API’s storage. Use synthetic domains for overridden E2E account emails; ordinary domains retain real delivery behavior. See [Email delivery and test recipients](../../docs/EMAIL_DELIVERY.md) for exact matching, privacy, cleanup, and failure behavior.

## Focused regression checks

Run the independent authoring-recovery, bank-synchronization, course-loading, student-grouping, activity-exception, and live compound-Test scenarios with:

```bash
npm run test:e2e -- --grep @regression
```

These focused tests require the normal migrated/seeded database, API, and web app, but no AI provider, Judge0, or web-design runner. Each test provisions its own disposable course/section scenario (with bank/MCQ content where needed) through public APIs and runs lifecycle-aware cleanup, so failures do not skip later scenarios in a serial chain. The bank/course fixture creates both shared course placement and group assignment, which are distinct content scopes.

Grouping scenarios also cover the automatic-assignment dialog, individual capacities and the apply-all shortcut, unassigned-only redistribution and insufficient slots, the Smart placeholder, student choice dates and permissions, names-only My teams cards, explicit confirmation, deadline expiry on an open page, concurrent last-slot claims, and stale teacher saves after student choices. They cover course-language default team names, editable-name persistence and collision avoidance, balanced random assignment with cancel/save, independent team assignments, section boundaries, concurrency, pending enrollments, failed-draft recovery, teacher/TA/student permissions, and enrollment/section deletion cascades.

Visibility coverage proves that hidden groupings are absent from learner responses and reject known-ID choice requests, including for existing members. It exercises Save/Cancel, reveal/hide/manual transitions that retain memberships, an open learner page refreshing after hiding, persisted assignment summaries, and responsive teacher settings.

Activity-exception scenarios cover all ten section override categories, teacher-ordered team priority, individual precedence, hidden grouping targets, Save/Cancel, effective learner access/SEB/attempts/grading/challenges, live started deadlines, teacher warning/cancellation and optional in-app messages, draft preservation during refresh and temporary hiding, extra attempts on an open page, submitted timing preservation, current membership, cleared section dates, atomic invalid-target/window rejection, legacy preservation, formative pruning, and lifecycle cleanup.

Only deliberate save/session failures and content/gradebook latency are intercepted. Recovery, synchronization, submission, and persistence assertions use the real services. Loading tests release their pending responses in `finally`; they use request/UI state instead of fixed sleeps. The `@regression` tag selects this focused set, not every regression assertion in the wider suite.

The broader suite still runs only the configured Chromium project. Useful next additions include the remaining synchronization branches (restore-original and both-copies-changed), compound-Test resume/navigation boundaries, and Firefox/WebKit coverage if those browsers become supported test targets.

Playwright transpiles the specs without type-checking them, and the root `npm run typecheck` currently omits `tests/e2e`. A dedicated E2E TypeScript gate is another useful follow-up; existing specs need type corrections before that gate can pass across the entire suite.

## Handling product failures

An E2E run is observational unless the task explicitly asks for product fixes. When a browser test exposes an application defect, preserve the evidence, document expected and observed behavior, and open or link a GitHub issue; do not change product code as part of the run. A stable known defect may use Playwright's expected-failure annotation only when it includes the issue URL, so the intended behavior remains executable and an unexpected recovery is reported. Test-code mistakes and fixture defects may still be corrected to let the requested product paths execute.

The maximum-attempt integrity check waits for each submission to finish, verifies the exhausted activity exposes only submission history, and confirms a direct extra submission request is rejected. The released-grade visibility check asserts that the selected released grade appears to the learner without exposing raw grading payloads.

The Coding Homework completion check waits for successful final answer submission, then verifies navigation back to the learner's course group and the activity's **Submitted** status. The assigned-activity host navigates away on success, so completion text inside the previous activity renderer is not a stable assertion.

The Parsons Student view check accepts either correct feedback or the current “out of order” feedback because the initial block order is randomized. The assertion must not depend on the initial shuffle. See the [2026-10-12 verification record](../../docs/E2E_RUN_2026-10-12.md) for this correction and the unresolved intermittent nested-content duplication observation.

## Authorization scenario catalog

The implemented section-scoped staff model, resolved policy decisions, and administrator, course-designer, teacher, TA, and multi-teacher traceability catalog are documented in [Role Authorization And Multi-Teacher E2E Plan](../../docs/ROLE_AUTHORIZATION_E2E_IMPLEMENTATION_PLAN.md). `access-control.spec.ts` covers global navigation/API boundaries and the course-designer grading policy; `staff-authorization.spec.ts` provisions independent co-teacher, section-teacher, TA, unrelated-teacher, and learner accounts across two sections and proves durable grants, denial, audit attribution, stale-edit rejection, removal, ownership transfer, and academic-data preservation.
