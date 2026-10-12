# Live activity settings verification — 2026-10-12

Local verification of [live assignment settings](ACTIVITY_ASSIGNMENT_EXCEPTIONS.md#live-updates-and-teacher-notices), using the development database and configured Google Chrome executable. No migration or production change was required.

## Results

- `npm test`: **1,192 passed in 250 files**, including the plugin architecture check.
- `npm run typecheck`: passed. A separate strict TypeScript check of the four changed E2E files also passed.
- `npm run lint`: **0 errors, 47 existing warnings**.
- Full E2E run: **129 passed, 1 failed**, out of 130 cases, in 8.9 minutes. No cases were skipped.
- After fixing the remaining failure, `activity-exceptions.spec.ts` and `live-test-settings.spec.ts`: **7 passed**, clean exit, in 1.5 minutes.
- The compound Test scenario was then strengthened to apply a student time exception over a different General limit and remove it after submission: **1 passed**, clean exit.
- Final teacher-notice permissions check: **1 passed**, clean exit; unit cases also verify that designers and section teachers cannot bypass existing messaging scope.

All 130 cases passed across the full run and focused rerun. The original full run itself was not clean. Its failure showed that an exhausted MCQ renderer retained its read-only state after the shared host exposed a newly granted attempt. The host now refreshes an exhausted renderer when another attempt becomes available, without remounting active editors. The corrected regression waits for the blocked/history state before granting the exception and verifies that the new Submit action becomes usable without navigation or reload.

Coverage includes live General/team/student timing, original-start deadline calculation, disabling timing, automatic expiry checks, warning cancellation, optional in-app notices, notices after hiding an activity, preserved answers after reopening, extra-attempt availability, submitted timing preservation, and compound Test student exceptions. The full run also exercised all activity plugins, grading/release, SEB, staff authorization, grouping choices, content workflows, and synthetic email capture.

## Evidence and documentation review

- `tmp/live-settings-full-run-2026-10-12/`: original full-run report, traces, screenshots, and log.
- `tmp/live-settings-e2e-final.log`: seven-case focused rerun.
- `tmp/live-settings-e2e-compound-final.log`: final compound exception check.
- `tmp/live-settings-e2e-permissions-final.log`: final notice/confirmation check with messaging authorization enforced.
- `tmp/live-settings-unit.log`, `tmp/live-settings-types.log`, `tmp/live-settings-e2e-types.log`, and `tmp/live-settings-lint.log`: automated checks.

Reviewed root README, project memory, architecture, documentation index, the assignment-policy reference, platform reference, Test implementation plan, browser-test documentation, and all affected activity-plugin READMEs, memories, and canonical references. Updated the timing and messaging decisions where needed; the root README and placeholder plugin required no changes. No affected documentation remains unverified.
