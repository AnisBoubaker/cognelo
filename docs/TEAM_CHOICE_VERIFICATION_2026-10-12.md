# Automatic assignment and student team selection — 2026-10-12

Verification of the team-choice changes on top of `19dcab7`. This record distinguishes the full run from reruns; it does not claim a clean first full-suite execution.

## Results

- All unit/API tests: **1,156 passed in 247 files**, including capacity, date-boundary, authorization, privacy, concurrent-write, and assignment-scope cases. Architecture checks passed.
- Type checking: passed across all workspaces and scripts. Both grouping E2E files also passed a separate strict TypeScript check; the root command does not include E2E specs. The final learner display adjustment passed the web workspace check again.
- Lint: no errors. The full check reported existing warnings and one new ref-cleanup warning; the new warning was corrected. Focused lint for the changed components, service, tests, and final display adjustment passed.
- Initial grouping E2E run: **10 passed**.
- Full E2E run: **118 passed, 1 failed, 3 did not run**, out of 122 cases. All ten grouping/team-choice cases passed in that run.
- Final content/team-choice rerun: **7 passed**, including all four content cases and all three new team-choice cases. Each of the 122 cases has a successful execution across the full run and rerun.
- Desktop and 390-pixel mobile screenshots were inspected. The final closed-window view highlights the confirmed team and removes selection controls; it does not show an unconfirmed draft selection as the selected team.
- Migration `202610120002_student_team_choice` applied with `npm run db:migrate:all`; Prisma was regenerated and the local API restarted. Existing memberships are retained, and old groupings remain manual.

## Existing intermittent content failure

`content-resources.spec.ts:67` again failed to find the duplicated text resource in the learner's expanded folder, although the teacher could see it. This matches the prior [grouping verification record](E2E_RUN_2026-10-12.md). Its three later serial cases did not run in the full suite. All four passed unchanged on the final rerun. No content-duplication product code or assertions were changed, and the underlying issue remains unresolved.

## Coverage and local evidence

Team coverage includes per-team capacities and the apply-all shortcut, both random scopes, insufficient slots, the disabled Smart placeholder, persisted From/Until and change permissions, names-only learner data, explicit confirmation, permitted changes, exact server cutoff and live-page expiry, locked choices, concurrent last-slot claims, stale teacher saves, enrollment/section/identity boundaries, and responsive layouts. See [Student groupings and teams](STUDENT_GROUPINGS.md).

Synthetic email delivery remains captured locally. The full run passed real `cognelo.local` test-email capture and account verification using the private outbox.

Ignored local artifacts:

- `tmp/team-choice-full-run-2026-10-12/`: preserved full-run log, report, and failure evidence.
- `tmp/playwright-report/` and `tmp/playwright-results/`: final seven-case rerun report and inspected screenshots.
- `tmp/team-choice-unit.log`, `tmp/team-choice-typecheck.log`, `tmp/team-choice-e2e-typecheck.log`, and `tmp/team-choice-lint.log`: broad verification.
- `tmp/team-choice-final-e2e.log`, `tmp/team-choice-final-web-typecheck.log`, and `tmp/team-choice-final-lint.log`: final checks.

Root README and documentation index were reviewed. Architecture, project memory, authorization coverage, platform details, the canonical grouping reference, and the browser-test guide were synchronized. No plugin behavior changed; the text plugin README/memory were reviewed for the existing failure and remain accurate.
