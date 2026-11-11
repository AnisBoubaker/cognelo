# User profiles and name-change policy

Administrators configure **Allow users to change their first and last names** at **Settings → Users**. The shared On/Off switch uses Save/Cancel and the unsaved-change guard. It is enabled by default, preserving existing behavior for both new installations and upgrades.

When disabled, all non-admin accounts, including teachers and course managers, see read-only first/last name fields in **Settings → Profile**. The profile heading's contextual help explains the restriction, and the name Save/Cancel bar is omitted. Administrators can always change their own names and edit anyone's name through user management. The policy affects account profile names, not retained enrollment or academic snapshots. The [gradebook](GRADEBOOK_IMPLEMENTATION_PLAN.md#current-participant-names) resolves current linked-account names for Student results, review headers and grade exports, with enrollment names as a fallback for pending accounts.

Password changes remain available independently, including when the name policy cannot be loaded. The existing current-password check, password validation, concurrent-update protection, session invalidation and renewal behavior remain in force. Email changes remain administrator-only.

## Persistence and API

- `ApplicationSettings.allowUserNameChanges` is a non-null boolean with default `true`. The additive, idempotent `202611100001_user_name_change_policy` migration adds it without changing existing settings or user rows. Apply through `npm run db:migrate:all`.
- `GET /api/settings/users` requires authentication and returns only `{ allowUserNameChanges: boolean }`. Other instance settings and the last administrator's identity are not exposed.
- `PUT /api/settings/users` requires administrator access and accepts exactly that boolean. It preserves other application settings and records `updatedById`.
- `PATCH /api/users/me` checks the current policy server-side on every non-admin name update. A disabled policy returns HTTP 403 with `USER_NAME_CHANGES_DISABLED`, even if the browser loaded the profile before the administrator disabled changes. Administrators bypass this restriction.
- Administrative user edits and `PUT /api/users/me/password` keep their existing independent authorization. The name policy never gates password changes.

Profile fields stay read-only until the policy loads successfully. Load/save errors use shared notifications. If an already-open name draft is rejected after the policy changes, the UI restores its saved names and locks the fields. Reloading the profile reads the current policy again.

## Verification

Core tests cover defaults, every non-admin global role, administrator editing of self/others, strict input validation, unrelated-setting preservation and password changes with the policy disabled. API route tests cover authentication and the service boundary. `tests/e2e/user-name-policy.spec.ts` verifies Save/Cancel/reload, stale-form and direct API rejection, administrator editing, password change and fresh sign-in, re-enabling names, and a policy-load failure. Its temporary policy change is restored in cleanup and its disposable account is removed. Functional tests run only locally or in isolated preprod.
