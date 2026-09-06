# Critical browser flows

The Playwright suite covers the platform's critical browser journeys with real API and database integration:

- anonymous access control, sign-in, first-time activation UI, and sign-out;
- learner, teacher, and administrator navigation boundaries;
- personal settings plus administrator user creation, filtering, plugin settings, and email settings;
- teacher creation of a subject, activity bank, course, group, and linked participant;
- learner discovery of assigned content, a summative MCQ submission, automatic grading, teacher grade release, and learner grade visibility.

All browser interactions use accessible roles, labels, and visible text. The only direct database access is teardown of records whose exact identifiers or unique generated titles were created by the same test run. The end-to-end learning test provisions a disposable current course through authenticated public API routes because the durable seed course can legitimately have expired availability dates.

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
