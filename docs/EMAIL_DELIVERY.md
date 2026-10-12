# Email delivery and test recipients

Core owns outbound email in `packages/core/src/email-delivery.ts`. Administrators configure SMTP or Microsoft Graph under **Settings → Email delivery**; see the [deployment runbook](DEPLOYMENT_UBUNTU_APACHE.md) for credentials and sender setup. System messages must use `sendSystemEmailToEligibleRecipient`, which requires an active user or an unclaimed section participant. The administrator's test message may target any valid address.

## Synthetic recipients

The shared delivery boundary captures these recipient domains locally, including their subdomains, instead of calling SMTP or Microsoft Graph:

- `cognelo.local`;
- `example.com`, `example.net`, and `example.org`;
- domains ending in `.test`, `.invalid`, or `.example` (and those suffixes themselves).

Matching is case-insensitive and uses the recipient's complete domain. An address such as `student@cognelo.local.university.edu` is not captured. Ordinary recipient domains continue through the configured provider.

This rule applies to verification codes, grade-challenge notifications/responses, and administrator test messages in every environment. It runs after authorization/recipient eligibility, but before reading provider configuration or credentials. It therefore also protects E2E runs against an already-running development API configured with a real mail provider. No environment switch or provider configuration is needed for capture. Verification codes still require `EMAIL_CREDENTIALS_ENCRYPTION_KEY` for their stored HMAC hash.

## Local outbox

`packages/core/src/email-outbox.ts` writes one JSON file per message to repository-level `storage/email-outbox/`. Each file contains `id`, `capturedAt`, `recipientEmail`, `subject`, `text`, and `html`. Creation uses a private directory (0700) and private files (0600), with atomic publication so readers never see partial JSON. A failed capture returns `EMAIL_CAPTURE_FAILED` and never falls back to a real provider.

The directory is ignored by Git and has no HTTP endpoint. Keep it private: captured verification messages contain usable codes. Deployment uses the existing instance-owned `storage` symlink; no migration or additional service is required. Captures persist until removed and are separate from media garbage collection.

`tests/e2e/fixtures/email-outbox.ts` reads this local outbox. The account-verification test retrieves the actual code and submits it through the real verification API; the administrator delivery test verifies capture for a unique `cognelo.local` address. Each removes only its own recipient's messages. These tests require access to the API's local storage directory. Tests using overridden accounts on ordinary domains can still send real mail; use synthetic addresses for test accounts.

Unit coverage proves provider/configuration bypass, recipient eligibility, fail-closed capture, exact domain matching, concurrent message capture, and file permissions. Existing injected-transport tests continue to exercise real-domain SMTP and Graph dispatch without network delivery.
