# Browser user flows

The Playwright suite covers the platform's critical browser journeys with real API and database integration:

- anonymous access control, sign-in, first-time activation UI, and sign-out;
- global administrator, course manager, teacher, and student boundaries, plus course owner, group teacher, and group TA permissions;
- personal settings plus administrator user creation, filtering, plugin settings, and email settings;
- teacher creation of subjects, activity banks, courses, groups, linked users, and pending participants;
- browser authoring, publication, course copying, assignment, and student completion for MCQ, Parsons, coding exercise, web-design coding exercise, and Coding Homework Grader activities;
- authoring a core compound Test from reusable bank activities and completing its student assessment flow, plus authoring and publishing reusable bank Tests, preserving their owned activity copies after source deletion, importing their full graphs into courses, and publishing course-authored Tests back to a bank;
- the placeholder activity's intentional unsupported authoring and learner states;
- summative assignment policy, draft autosave and resume, multiple attempts, attempt limits, automatic grading, gradebook filtering/export, release/hide controls, and student grade visibility;
- activity-settings dialog layout and placeholders, Cancel behavior, formative/summative field filtering, Assign-to-all preservation, unassignment cleanup, inheritance and every group override category, save/reopen persistence, assigned/unassigned access, group visibility, upcoming and expired availability, Safe Exam Browser gating, and effective per-group gradebook policy;
- bank activity publication from the editor and list, version comparison, duplication, and movement between banks; and
- group settings updates and restoration.

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

## Handling product failures

An E2E run is observational unless the task explicitly asks for product fixes. When a browser test exposes an application defect, preserve the evidence, document expected and observed behavior, and open or link a GitHub issue; do not change product code as part of the run. A stable known defect may use Playwright's expected-failure annotation only when it includes the issue URL, so the intended behavior remains executable and an unexpected recovery is reported. Test-code mistakes and fixture defects may still be corrected to let the requested product paths execute.

The maximum-attempt integrity check waits for each submission to finish, verifies the exhausted activity exposes only submission history, and confirms a direct extra submission request is rejected. The released-grade visibility check asserts that the selected released grade appears to the learner without exposing raw grading payloads.
