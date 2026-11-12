# System error codes

System errors identify infrastructure, configuration, transport and unexpected
server failures. They are separate from actionable validation, authentication,
permission and conflict errors, which retain their existing messages and codes.

Production displays **System error (SYS-002).**, for example, localized to the
interface language. Only `NODE_ENV=development` adds the code's fixed diagnosis
and suggested checks. Test and other modes use production wording by default.
Development guidance never copies an exception, SQL, connection URL, credential,
filesystem path, provider response or stack into a browser response.

## Code catalogue

Codes describe failure categories, not unique incidents. Never renumber or reuse
one for a different meaning. Use the displayed code, request time and affected
operation when locating the original exception in private API logs.

| Code | Meaning | Operator/developer checks |
| --- | --- | --- |
| `SYS-001` | Unexpected server failure, or an HTTP 5xx response without a recognized system code | Inspect API/proxy logs for the original exception and deployed versions. Do not infer a database outage solely from this code. |
| `SYS-002` | Database unreachable, connection establishment timed out, or connection closed | Check PostgreSQL health, connectivity and `DATABASE_URL`. Locally, start Docker and run `docker compose up -d db`; confirm `docker compose ps db` is healthy. |
| `SYS-003` | Database authentication, database existence, access, URL or TLS configuration rejected | Check the intended database, credentials, permissions, URL and TLS configuration privately. Never paste credentials into an issue. |
| `SYS-004` | A required database table or column is missing | Verify the application/database versions, apply `npm run db:migrate:all` through the normal upgrade procedure, regenerate clients and restart development servers. Never reset or reseed existing data to repair this error. |
| `SYS-005` | Database operation timeout, exhausted pool or too many open connections | Check database health/load and connection limits. Investigate slow queries or pool saturation before retrying. |
| `SYS-006` | A declared server operation/dependency failed (an `AppError` with HTTP 5xx) | Look up the accompanying existing API `code` in server logs. Check the relevant service's configuration, health and credentials. |
| `SYS-007` | Browser could not receive an API response | Check API availability, `NEXT_PUBLIC_API_URL`, network, CORS and reverse proxy configuration. This code alone cannot distinguish a stopped API from a browser/network policy failure. |
| `SYS-008` | Invalid API JSON, or invalid startup server-time/timezone data | Inspect API/proxy responses and version compatibility. Startup requires a parseable timestamp and a nonempty valid timezone; never guess a browser timezone to bypass this failure. |

## API and browser contract

The shared API `handleRoute` boundary classifies uncaught Prisma failures by
metadata across core/plugin clients. Initialization errors sometimes omit
`errorCode`; known connection/authentication message patterns are used only for
classification, never serialized. Other unexpected exceptions use `SYS-001`.
Database-unavailable/pool failures return HTTP 503; configuration/schema and
unexpected failures return 500. Declared server errors retain their original HTTP
status and machine `code`, with `SYS-006` added as their support category.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "systemCode": "SYS-002",
    "message": "System error (SYS-002)."
  }
}
```

System responses omit exception details in every mode. The server logs
`system_error`, `systemCode`, the existing machine `code` and the original error
for private diagnosis. Normal JSON routes and the shared NDJSON progress helper
use the same policy. Validation and ordinary HTTP 4xx errors are unaffected.

The shared web JSON client preserves `systemCode` on `ApiError`, rebuilds its
localized message from the catalogue, and never displays server-supplied 5xx
messages/details, including during mixed-version upgrades. Uncoded/unknown-code
5xx responses (including HTML proxy failures) use `SYS-001`; failed fetches use
`SYS-007`; malformed successful JSON uses `SYS-008`. Empty HTTP 204 success
responses remain supported. Explicit request cancellation is not an outage.

Application startup displays the code instead of blaming time/timezone loading
for every infrastructure error. Retry, the existing 30-second refresh and
focus/visibility refresh can recover it. After a successful initial load, later
sync failures preserve the mounted page, date forms and last monotonic clock
anchor. Course-time loading and sign-in/activation also preserve system codes.

This contract covers failures passing through the shared route/client helpers;
it does not replace plugin-owned workflow/job states, learner program errors,
arbitrary render exceptions or custom download/stream protocols. New custom
transports must adopt this policy explicitly instead of copying exception text
into public responses.

## Adding or changing codes

1. Add a stable entry to `packages/contracts/src/system-errors.ts` and this table.
2. Add the corresponding diagnosis in all web locales (English uses the shared
   catalogue), then classify the failure at its owning server/transport boundary.
3. Retain existing machine codes used for application control flow. Keep raw
   diagnostics in server logs; development uses only fixed, reviewed guidance.
4. Verify development guidance, exact production wording, secret withholding,
   status/stream propagation and recovery. Never interrupt shared services or run
   failure simulations against production.

## Verification

API/client unit checks cover Prisma initialization with and without a code,
missing schema, pool failures, development/production policy, private-detail
withholding, ordinary 4xx behavior, streamed errors, network failure and
cancellation. `tests/e2e/system-errors.spec.ts` simulates startup failures in one
local browser, checks Retry and retained form state, and verifies sign-in error
reporting without creating accounts or stopping services. When targeting an
isolated production build, `E2E_SYSTEM_ERRORS_PRODUCTION=1` asserts code-only UI
wording; it does not authorize production testing.
