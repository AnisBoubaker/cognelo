# Application timezone and authoritative time

Administrators configure the instance-wide IANA timezone at **Settings → Date and time** (`/settings/time`). Fresh installations and upgraded databases default to `UTC` until configured. This is a presentation/scheduling preference, separate from the operating system timezone and the language of a course or account.

**Allow teachers (course owners) to set a course timezone** is off by default. When enabled, explicit course owners and administrators can select a timezone under **Course → Settings → General → Date and time**. Other course teachers, section staff, and students cannot change it. Existing and new courses automatically inherit the current application timezone until an owner selects a different one. **Use application timezone** returns the course to inheritance. A custom course choice survives later application-timezone changes. Disabling the option makes every course use the application timezone while retaining custom choices for possible re-enablement.

## Persistence and API

Core `ApplicationSettings` has one `instance` row with `timeZone`, `allowCourseTimeZone`, `updatedAt`, and the last administrator's `updatedById`. Migration `202610210001_application_timezone` adds the singleton; `202610210002_course_timezone` adds the default-false permission and nullable `Course.timeZone`. A null course value means inherit, including for existing courses. Apply with `npm run db:migrate:all`; neither migration rewrites dates. The server validates IANA zone identifiers with `Intl`, rejects unknown zones and numeric offsets, and canonicalizes accepted aliases.

- `GET /api/application-time` exposes only the configured timezone and an ISO `serverNow`. It is public so login/activation screens can initialize the same clock; responses are not cached.
- `GET /api/settings/time` is admin-only and adds `allowCourseTimeZone` and available timezone identifiers.
- `PUT /api/settings/time` is admin-only, CSRF-protected, and accepts `{ timeZone, allowCourseTimeZone? }`. Omitting the boolean preserves it. Teachers and learners cannot change the instance policy. Saving records the actor.
- `GET /api/courses/:courseId/time` requires course-view access and returns the effective zone, stored course choice, application default, policy, and server-computed `canConfigure`. Only permitted owners/admins receive selector choices. Responses are not cached.
- `PUT /api/courses/:courseId/time` accepts `{ timeZone: IANA_IDENTIFIER | null }`, checks the current application policy and explicit ownership (or administrator role), and atomically updates the choice plus a `course_timezone_updated` audit with before/after values. A global teacher role, creator provenance, or an ordinary course-teacher membership is insufficient.

UTC instants remain authoritative in persistence and transport. Changing the display timezone does not move an existing opening time, deadline, submission, or attempt start.

## Shared frontend boundary

`AppTimeProvider` loads the server setting before mounting date-bearing pages. It does not fall back to the browser timezone when loading fails. Server time is anchored to `performance.now()`, corrected every 30 seconds and on focus/visibility changes, and drives availability labels and team-choice closing indicators. A later clock-sync failure retains the last monotonic anchor and retries. Local-clock edits do not move that anchor.

`@cognelo/activity-ui` exports `useApplicationTime`, `useServerNow`, explicit-zone formatting/conversion helpers, and `AppDateTime`. The `/courses/:courseId` layout loads the authorized course timezone before mounting course pages, then supplies it through the same context while retaining the application provider's monotonic clock. This covers nested section, assigned activity, preview, report, gradebook, and material pages, including plugin history/review displays and date-entry dialogs. Outside a course, the application zone applies. Loading failures offer Retry rather than mounting date forms with a guessed zone. Plugins must not reintroduce implicit `toLocaleString()` or host-timezone `Date` getters for displayed dates.

Date entry uses the configured zone, displayed beside each date/time control, and converts to an ISO UTC instant before saving. Conversion uses the Temporal polyfill instead of the browser timezone. DST follows Temporal's standard `compatible` policy: a repeated fall-back time selects the earlier occurrence; a nonexistent spring-forward time advances through the gap. Invalid calendar dates are rejected. See [Temporal timezone semantics](https://tc39.es/proposal-temporal/docs/timezone.html).

Existing open pages retain their loaded timezone until reloaded, so an administrator's or owner's change cannot silently reinterpret an in-progress date form. The administrator's own settings page and the owner's course settings workspace adopt their respective successful changes immediately. Leaving a course restores the application context; moving between courses loads each course's own zone. Server-clock synchronization continues independently.

## Security boundary

Browser timezone and browser wall-clock values are never authorization inputs. The API already checks section publication/availability, effective assignment opening times, attempt limits, and write deadlines against server `new Date()`/`Date.now()`. Test start/state/action routes independently resolve those policies. Student exceptions and live deadline changes are evaluated on the server. No browser-supplied `now` value controls those checks.

An expired activity may still expose permitted history or a final timeout-submission route; that does not authorize further answering. Timed standalone and compound Test countdowns use server-reported remaining seconds plus monotonic elapsed time, rather than subtracting the computer's clock from a timestamp. Only the server decides whether a write is accepted.

Keep server clocks synchronized operationally. The instance timezone setting does not change the OS clock or timezone, and cannot repair an incorrect server clock.

## Verification

Unit checks cover administrator/owner authorization, default inheritance, policy disablement, retained choices, audit records, invalid zones, server timestamps, different host/browser zones, summer/winter offsets, DST transitions, and explicit-zone round trips. Existing timing/availability/countdown tests cover server enforcement. `tests/e2e/application-time.spec.ts` covers persistence, unauthorized mutation, Toronto scheduling from a Tokyo browser, unchanged stored instants after a timezone change, and early/late Test requests with a deliberately altered browser clock. `tests/e2e/course-time.spec.ts` covers the administrator switch, new/existing course defaults, owner Save/Cancel/reload, cross-course isolation, Toronto scheduling and learner display, disable/re-enable/reset inheritance, current ownership checks, and audit attribution.
