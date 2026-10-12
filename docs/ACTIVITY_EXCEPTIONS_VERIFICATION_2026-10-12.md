# Activity exception verification — 2026-10-12

Local verification of [team and student activity exceptions](ACTIVITY_ASSIGNMENT_EXCEPTIONS.md), using the migrated development database and the configured Google Chrome executable. No production environment was changed.

The timing assertions in this historical run predate [live assignment settings](ACTIVITY_ASSIGNMENT_EXCEPTIONS.md#live-updates-and-teacher-notices), which now update unsubmitted deadlines.

## Results

- Core migration `202610120004_activity_assignment_exceptions` applied successfully through `npm run db:migrate:all`; Prisma schema validation passed.
- `npm test`: **1,177 passed** in 249 files, including the architecture boundary check.
- `npm run typecheck`: passed. The changed core tests and a separate strict TypeScript check of both activity-settings/exception E2E files also passed.
- `npm run lint`: **0 errors, 47 existing warnings**.
- Full E2E run: **122 passed, 2 failed, 3 did not run**, out of 127 cases.
- Rerun of `activity-exceptions.spec.ts` and `content-resources.spec.ts`: **8 passed**, including all four new exception cases and all previously skipped content cases. After assertions and fixture cleanup completed, the worker stayed alive; it was interrupted after 3.5 minutes and the command exited 130. This is not a clean runner exit. Every test case passed across the full run and targeted rerun; the full run itself was not clean.
- Final standalone `activity-exceptions.spec.ts` run: **4 passed in 12.7 seconds**, with a clean exit (0).

The full run covered the existing assignment settings, grading/release, all activity types, Safe Exam Browser, staff authorization, groupings, student choices, Student view, and compound Tests. The new exception cases cover each override category, priority conflicts, student precedence, private targets, immutable started deadlines, current membership, cleared dates, atomic failures, and cleanup. Desktop/mobile exception-dialog screenshots were inspected.

## Failure analysis

One new exception fixture read General's default formative policy even though its direct assignment was summative. Its first settings save correctly required conversion confirmation. The fixture now explicitly selects summative mode; this is a test setup correction, with no relaxed assertion.

The other failure was the existing intermittent nested-text duplication case at `content-resources.spec.ts:67`: the teacher saw the copy but the learner could not find it in the expanded folder. Its three later serial cases were skipped. This matches the [earlier verification record](E2E_RUN_2026-10-12.md#nested-text-content-duplication-intermittent-unresolved); all four content cases passed unchanged on the rerun. No content-duplication product code or assertion was changed, and the underlying intermittent issue remains unresolved.

An initial unit run also exposed a wall-clock boundary in the existing session-renewal test: the real clock crossed a second before the test advanced it by one hour. The test now freezes Date before token issuance, while leaving bcrypt's asynchronous timers real. The complete unit rerun passed.

## Evidence and documentation review

- `tmp/activity-exceptions-full-run-2026-10-12/`: original full-run log, report, traces, screenshots, and failure context.
- `tmp/activity-exceptions-e2e-rerun.log`: focused rerun output.
- `tmp/activity-exceptions-e2e-final.log`: final standalone exception run with a clean exit.
- `tmp/activity-exceptions-rerun-2026-10-12/`: eight-case rerun report and screenshots, preserved before the final standalone exception run.
- `tmp/activity-exceptions-unit.log`, `tmp/activity-exceptions-typecheck.log`, `tmp/activity-exceptions-e2e-typecheck.log`, and `tmp/activity-exceptions-lint.log`: final command logs.

Root README, project memory, architecture, documentation index, grouping policy, platform references, Test plan, and browser-test guide were reviewed. The new canonical policy and links in the MCQ, Parsons, Programming Exercise, Web Design, and Homework plugin READMEs, memories, and references describe the shared integration. Placeholder and Text Content plugin documentation remains accurate without changes. All changed documentation links were checked locally; no affected documentation remains unverified.
