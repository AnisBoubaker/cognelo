# Application timezone and authoritative time

Administrators configure the instance-wide IANA timezone at **Settings → Date and time** (`/settings/time`). Fresh installations and upgraded databases default to `UTC` until configured. This is a presentation/scheduling preference, separate from the operating system timezone and the language of a course or account.

## Persistence and API

Core `ApplicationSettings` has one `instance` row with `timeZone`, `updatedAt`, and the last administrator's `updatedById`. Migration `202610210001_application_timezone` adds it without rewriting any existing dates. The server validates IANA zone identifiers with `Intl`, rejects unknown zones and numeric offsets, and canonicalizes accepted aliases.

- `GET /api/application-time` exposes only the configured timezone and an ISO `serverNow`. It is public so login/activation screens can initialize the same clock; responses are not cached.
- `GET /api/settings/time` is admin-only and adds available timezone identifiers.
- `PUT /api/settings/time` is admin-only, CSRF-protected, and accepts exactly `{ timeZone }`. Teachers and learners cannot change it. Saving records the actor.

UTC instants remain authoritative in persistence and transport. Changing the display timezone does not move an existing opening time, deadline, submission, or attempt start.

## Shared frontend boundary

`AppTimeProvider` loads the server setting before mounting date-bearing pages. It does not fall back to the browser timezone when loading fails. Server time is anchored to `performance.now()`, corrected every 30 seconds and on focus/visibility changes, and drives availability labels and team-choice closing indicators. A later clock-sync failure retains the last monotonic anchor and retries. Local-clock edits do not move that anchor.

`@cognelo/activity-ui` exports `useApplicationTime`, `useServerNow`, explicit-zone formatting/conversion helpers, and `AppDateTime`. All course/section availability labels, activity settings and exceptions, team-choice dates, histories, review timestamps, notifications, and grade-export filenames use this shared setting. Plugins must not reintroduce implicit `toLocaleString()` or host-timezone `Date` getters for displayed dates.

Date entry uses the configured zone, displayed beside each date/time control, and converts to an ISO UTC instant before saving. Conversion uses the Temporal polyfill instead of the browser timezone. DST follows Temporal's standard `compatible` policy: a repeated fall-back time selects the earlier occurrence; a nonexistent spring-forward time advances through the gap. Invalid calendar dates are rejected. See [Temporal timezone semantics](https://tc39.es/proposal-temporal/docs/timezone.html).

Existing open pages retain their loaded timezone until reloaded, so an administrator's change cannot silently reinterpret an in-progress date form. The administrator's own settings page adopts a successful change immediately. Server-clock synchronization continues independently.

## Security boundary

Browser timezone and browser wall-clock values are never authorization inputs. The API already checks section publication/availability, effective assignment opening times, attempt limits, and write deadlines against server `new Date()`/`Date.now()`. Test start/state/action routes independently resolve those policies. Student exceptions and live deadline changes are evaluated on the server. No browser-supplied `now` value controls those checks.

An expired activity may still expose permitted history or a final timeout-submission route; that does not authorize further answering. Timed standalone and compound Test countdowns use server-reported remaining seconds plus monotonic elapsed time, rather than subtracting the computer's clock from a timestamp. Only the server decides whether a write is accepted.

Keep server clocks synchronized operationally. The instance timezone setting does not change the OS clock or timezone, and cannot repair an incorrect server clock.

## Verification

Unit checks cover administrator authorization, invalid zones, server timestamps, different host/browser zones, summer/winter offsets, DST transitions, and explicit-zone round trips. Existing timing/availability/countdown tests cover server enforcement. `tests/e2e/application-time.spec.ts` covers persistence, unauthorized mutation, Toronto scheduling from a Tokyo browser, unchanged stored instants after a timezone change, and early/late Test requests with a deliberately altered browser clock.
