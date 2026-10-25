# Security boundaries

This reference describes enforced application contracts and deployment requirements. It is not a claim that the application or an external deployment is free of vulnerabilities. Keep incident evidence, real inventories, tokens, and reproduction reports outside tracked files.

## Learner access and assessment integrity

Learner course, section, content-resource, and legacy material reads resolve actual enrollment, section availability, effective visibility, and hidden ancestors. Query flags can further restrict results but cannot reveal hidden content or another section. Course-level reads combine only authorized section views. Unplaced activities/materials and subject authoring materials are not learner course data. Teachers retain their authorized authoring/grading scopes.

Activity configurations and historical Test children use plugin-owned public projections. Private source, answer keys, reference order/indentation, nested bank/version records, and private fingerprints stay server-side. Test authoring is manager-only. Attempt allowance and numbering share a database transaction and a per-item/participant lock. Deleted attempts cannot be resubmitted.

The assigned plugin dispatcher rechecks the deadline after reading the request body. An expiry-allowed route must provide `expiredAttemptInput`, which reconstructs input solely from saved server state; a missing handler fails closed. MCQ, Programming Exercises and Web Design use the core response draft. Parsons uses its saved arrangement; homework uses saved challenge answers. Starting a new homework upload after expiry is forbidden. Draft deletion also obeys the write deadline. Compound Tests continue to finalize their saved child responses through their existing submission claim.

## Requests and uploads

The API reads streams with a byte ceiling before JSON/multipart parsing, including requests without Content-Length. Current ceilings are 2 MiB for ordinary JSON, 36 MiB for plugin upload JSON, 26 MiB for multipart forms, and 8 KiB for login/activation. JSON validation also limits depth to 32, any collection to 2,000 elements, and total nodes to 20,000. A process admits at most four large body reads at once. Uploads have a 60-second read deadline; capacity failures return a retryable 429.

Legacy uploads authorize their course/group/material target before buffering, check destination parents before staging, and remove staged files if persistence fails. Storage identifiers are server-owned. Legacy and File-plugin downloads use UUID filenames, validated scope components, canonical directory containment, and a no-follow file descriptor. Extraction uses the same file boundary, and the basic PDF literal parser scans malformed/nested strings in linear time. File replacement never follows a user-supplied path.

Homework ZIPs are capped at 25 MiB compressed, 64 MiB expanded, 8 MiB per entry, and 1,000 directory entries. Files over 32 KiB cannot exceed a 200:1 compression ratio. The complete central directory is checked before decompression, and zlib receives a hard output ceiling for each stream. Unsafe/absolute/duplicate paths, links, multi-volume archives, unsupported compression, and malformed lengths fail closed. The teacher's smaller archive/file policy still applies. Source analysis caps aggregate text at 2,000,000 characters and an archive at 2,000 functions and 100 retained diagnostics per file; signatures and line positions use bounded scans rather than backtracking or repeated full-file scans. Existing oversized configured limits are capped by the plugin migration.

Homework processing allows two concurrent uploads per API process, 20 uploads/minute per user, 100/minute per activity, and a 1 GiB admission quota per user/activity, accounting for retained files and private analysis/question data. Invalid-upload reports pass the same admission check. Reference excerpts are bounded to 4,000 UTF-8 bytes while retaining their IDs and full-source hashes. The storage check and valid final upload serialize under database locks, retain at least 1 GiB of free space, and clean the caller’s expired preflight artifacts without deleting academic submissions. A valid final upload reserves a core attempt and persists plugin artifacts in the same transaction; failures roll back records and clean staged files. One unfinished workflow is allowed, even with different retry keys. Final answers lock the submission and core attempt, update all answers atomically, and reuse the reserved attempt. Identical finalization retries are idempotent; completed answers cannot be edited. Legacy unfinished submissions reserve their attempt at finalization.

Internal homework analysis is staff-only. Learner responses omit reference-search provenance, storage paths, internal metadata, and raw processing errors. Background work retains private diagnostic evidence for staff.

## Authentication and browser requests

Session JWTs require the session-specific issuer/audience, HS256, subject, issue/expiry times, and authentication version. SEB launch/access tokens cannot authenticate or renew sessions. Password changes and administrative email changes invalidate older sessions; the password-changing browser receives a fresh cookie. New/reset passwords require at least eight characters and at most 72 UTF-8 bytes to avoid bcrypt truncation.

Unverified session DTOs withhold invitation-derived names and roles until email possession is verified. Failed login responses do not distinguish unknown, inactive, or invited accounts. Existing/unknown activation failures use one public response. Login and activation enforce persistent limits of 10 attempts/account/15 minutes and 200 requests/source/minute. A successful login clears its account bucket. Limits use a database table with expiring, secret-keyed identifiers and work across processes/restarts. 429 responses include Retry-After.

By default the API ignores forwarding headers and uses a shared source bucket. Set `AUTH_TRUST_PROXY=true` only when the API is reachable exclusively through a proxy which removes incoming `X-Cognelo-Client-IP` and sets it from the actual peer address. Never use arbitrary client-supplied X-Forwarded-For values as authority. Account limits remain independent of this setting.

Email verification serializes the resend cooldown and code attempts per user. It retains the 10-minute lifetime, 60-second cooldown, and five incorrect guesses; additional endpoint limits are five sends/hour and 30 checks/hour. Code hashes bind the user and current email, so an older code cannot verify a changed address. Password-change attempts are limited to 10/user/15 minutes.

Unsafe browser requests, including anonymous login/activation, reject a foreign Origin. Cookie-bearing mutations require the configured Origin. Non-browser requests without an Origin remain supported. Session cookies remain HttpOnly, SameSite=Lax, and Secure in production. Login return paths are normalized and checked against the current origin, including backslash/encoded separators.

## Service credentials and model connections

New AI keys use authenticated AES-256-GCM envelopes with purpose-bound associated data. Public DTOs return only key-presence flags. `npm run db:migrate:all` encrypts legacy plaintext keys and disables legacy base URLs containing credentials/query/fragment data after removing those components. Preserve the instance credential key and database backups together; migration is idempotent. Base URL credentials are rejected on new saves.

Personal model connections require public HTTPS destinations; public destinations require HTTPS even for administrator-managed connections. DNS is validated and pinned to the actual connection, redirects are not followed, responses are capped at 4 MiB, and requests time out after 120 seconds. Private HTTP endpoints such as local Ollama require an administrator-owned personal connection or an administrator-managed **global** connection. Provider error bodies are not returned to clients. The instance credential key also protects mail and runner credentials; model envelopes use their own purpose marker.

The separate API PDF renderer also enables Chromium sandboxing, filters its environment to browser/font settings, and uses a data-only resource policy with scripting/network disabled. See [answer exports](ANSWER_EXPORTS.md) for Linux host policy.

The Web Design service requires its dedicated Bearer credential and interprets the [restricted Playwright command contract](../packages/plugin-activities/plugin-web-design-coding-exercises/docs/REFERENCE.md#runner-command-contract). It does not evaluate test source in Node. Chromium sandboxing, denied browser network access, bounded execution, and the container limits remain mandatory.

## Local setup and upgrades

Run `npm run local:configure` before starting a new development stack. It generates private `.env` values and `infra/judge0/judge0.conf` from examples. The generated files are ignored by Git and excluded from runner build context; no shared development service password is shipped. Development app and database/runner listeners bind to loopback. Demo seeding requires the local helper’s explicit `COGNELO_ALLOW_DEMO_SEED=true` and always refuses production mode. Production bootstrap rejects the shared demo password and enforces bcrypt’s input-byte ceiling.

For an existing default Docker stack, stop the local app, keep the database containers available, and run `npm run local:configure -- --rotate-existing`. The helper refuses remote database URLs, preserves volumes, rotates default service credentials, re-encrypts stored credentials, and writes protected recovery snapshots outside the checkout. Restart the app and execution containers together. Existing verified academic records are unchanged; pending verification codes expire when their encryption key changes. Custom deployment inventories and recovery paths belong in private operator notes.

Upgrades require `npm run db:migrate:all` for the core rate-limit table, bounded homework requirements, and credential backfill. Production upgrades still follow the backup, clone rehearsal, approval, and rollback gates in the deployment runbooks. Do not run the local credential helper against production.

## Verification

Unit/integration tests exercise body ceilings, archive expansion, public projections, endpoint pinning, credential envelopes, token purposes, timing, and authorization. `tests/e2e/security-hardening.spec.ts` uses disposable local content to test alternate list/download routes, atomic homework uploads/finalization, throttling, concurrent verification guesses, password-session invalidation, model-key storage, and a submission body that crosses the deadline. Run the normal role, solution, timing, and learner workflows alongside these tests. Dependency changes require audit, typecheck, tests, production builds, and a real cropped-screenshot runner smoke test. npm audit does not inspect bundled vendor copies: Monaco’s complete vendored DOMPurify module is replaced during asset preparation with the maintained package. The preparation script fails on an unknown upstream module boundary and checks the generated assets for stale sanitizer versions; browser tests inspect the loaded AMD module and editor workers.
