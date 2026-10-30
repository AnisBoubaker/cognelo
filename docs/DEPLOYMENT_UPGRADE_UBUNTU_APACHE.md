# Upgrading Cognelo on Ubuntu with Apache

This guide upgrades an existing Cognelo installation created with [DEPLOYMENT_UBUNTU_APACHE.md](DEPLOYMENT_UBUNTU_APACHE.md) from one immutable Git tag to another.

The examples upgrade instance `instance1` from `cognelo-0.5.0` to `cognelo-0.6.0`. Replace the instance name, paths, ports, database, and tags with the values used by the real installation.

The normal upgrade does **not** copy `/srv/cognelo/instance1/shared` or its potentially large `storage` directory. Every deployment worktree links to the same persistent `.env` and `storage`. This procedure makes a small, protected copy of the application `.env` and a PostgreSQL database dump. Uploaded storage should already be covered by the installation's normal off-host backup or snapshot policy.

Current security upgrades require the core `202610250001_security_rate_limits` and homework `202610250010_bounded_upload_requirements` migrations through `npm run db:migrate:all`. That command also encrypts legacy model keys with the existing instance credential key and disables legacy model URLs containing embedded credentials/query/fragment data after removing those components. Preserve that key with database backups. Personal model endpoints now require public HTTPS; configure private/local models as administrator-owned personal or global connections. The local credential helper is for development only. See [Security boundaries](SECURITY_BOUNDARIES.md) for request limits and compatibility details.

## Before starting

You need:

- SSH and sudo access to the application server;
- the existing repository at `/srv/cognelo/instance1/repository`;
- the current release under `/srv/cognelo/instance1/current`;
- enough disk space for one additional release worktree and its dependencies/build output; and
- a new immutable Git tag that has already passed CI.

Never build over `current`, deploy a branch such as `main`, run `npm run db:seed`, or remove the previous release until the new release has been accepted.

## Mandatory pre-production release gate

Do not create a tag or production release until the exact release candidate has passed an isolated pre-production upgrade rehearsal and the user has authorized release/deployment. Authorization may explicitly be conditional on a successful rehearsal; once that condition is met, a separate approval or production functional test is not required. The release process is:

1. the designated approver supplies a fresh, protected dump of the currently deployed production database;
2. restore that dump into an isolated pre-production database;
3. deploy the exact current commit to pre-production and run its complete `npm run db:migrate:all` path, including core and plugin migrations, without errors;
4. pass the required automated/functional checks in local or isolated preprod, production builds, service health checks, and migration-log review; and
5. under the user's release authorization, create the immutable tag and GitHub Release from that unchanged candidate.

Never reuse a database that was migrated by an earlier candidate: restore the supplied production dump before every rehearsal. Record the source production version, candidate commit, migration log, test evidence, and user authorization in the private release record. The release tag must resolve to the validated commit. If candidate code changes, repeat the relevant tests and complete rehearsal with a fresh restore. Do not infer permission to deploy from test success alone; honor any authorization already provided by the user.

## Production validation boundary

Never run browser/E2E tests on production or create test accounts, synthetic submissions, grades, or other test data there. Perform functional workflows, grading/runner checks, and upgrade rehearsals locally or in isolated preprod. A successful preprod rehearsal is sufficient for an authorized deployment.

After deployment, use only read-only service health, deployed-version, log, and integrity checks. Normal authorized upgrades, migrations, configuration changes, and backups remain permitted. This rule persists across sessions and releases. Only an explicit user request to run browser tests on production overrides it for the requested scope; a general request to test, release, rehearse, or deploy does not.

Check the current release and service health:

```bash
readlink -f /srv/cognelo/instance1/current
sudo -u instance1 git -C /srv/cognelo/instance1/current \
  describe --tags --exact-match

systemctl is-active instance1-api instance1-web apache2 postgresql
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://instance1.example.com/api/health
```

Stop and investigate if the current release is not the expected old tag or the instance is unhealthy before the upgrade.

## 1. Read the release notes and private upgrade checklist, then fetch the tag

Public GitHub Release notes contain only **Highlights**, **Fixed**, **Database migrations** (Yes/No and how to apply them), and **Environment variables** when they changed. Use [RELEASE_NOTES_TEMPLATE.md](RELEASE_NOTES_TEMPLATE.md). Do not publish approval names/dates, rehearsal results, validation narratives, inventories, or deployment procedures in release notes.

The release author must separately prepare a private operator checklist covering:

- the supported previous tag and approved target revision;
- backups, downtime, storage, and schema compatibility;
- environment, host, service, runner, and sandbox changes;
- plugin actions and post-upgrade jobs;
- preprod functional checks, read-only production validation, rollback, and private evidence.

Public release notes do not replace that checklist. If required migration instructions or the private checklist are missing, stop and have the release author complete the appropriate record. Do not infer operational requirements during a production upgrade.

Read both records before connecting to production, and track operational completion in the private maintenance record.

Before applying any environment changes, create the protected upgrade backup directory and preserve the current application `.env`:

```bash
sudo install -d -m 0700 \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0

sudo cp --preserve=mode,ownership,timestamps \
  /srv/cognelo/instance1/shared/.env \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0/instance1.env

sudo chmod 0600 \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0/instance1.env
```

This file contains production secrets. Keep the backup root-only, encrypt it before off-host transfer, and never attach it to logs, tickets, or release notes.

Fetch repository updates without changing the active release:

```bash
sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  fetch --prune --tags

sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  rev-parse --verify 'refs/tags/cognelo-0.6.0^{commit}'
```

If production tags are signed, verify the tag:

```bash
sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  verify-tag cognelo-0.6.0
```

Confirm that the fetched tag matches the approved revision in the private upgrade checklist and record its commit:

```bash
sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  rev-list -n 1 cognelo-0.6.0
```

Apply environment changes listed in the release notes and manual actions recorded in the private upgrade checklist. If a new environment value is required, add it manually to `/srv/cognelo/instance1/shared/.env`. Do not replace the production file with `.env.example`, and do not rotate existing secrets as part of a routine upgrade unless the private upgrade checklist explicitly requires it.

## 2. Create and build the new release

Make sure the destination does not already exist:

```bash
test ! -e /srv/cognelo/instance1/deployments/cognelo-0.6.0
```

Create a detached worktree at the exact tag:

```bash
sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  worktree add --detach \
  /srv/cognelo/instance1/deployments/cognelo-0.6.0 \
  refs/tags/cognelo-0.6.0
```

Link the persistent environment and storage. These commands create symlinks; they do not copy the shared data:

```bash
sudo -u instance1 ln -s ../../shared/.env \
  /srv/cognelo/instance1/deployments/cognelo-0.6.0/.env

sudo -u instance1 ln -s ../../shared/storage \
  /srv/cognelo/instance1/deployments/cognelo-0.6.0/storage
```

Verify the links before continuing:

```bash
readlink -f /srv/cognelo/instance1/deployments/cognelo-0.6.0/.env
readlink -f /srv/cognelo/instance1/deployments/cognelo-0.6.0/storage
```

They must resolve to:

```text
/srv/cognelo/instance1/shared/.env
/srv/cognelo/instance1/shared/storage
```

Install, generate, test, and build while the old release remains online:

Teacher answer PDF exports additionally need the API-side Chromium browser and multilingual fonts. Complete the [answer-export runtime setup](ANSWER_EXPORTS.md#runtime-installation) for the service account before enabling downloads; this is separate from the Web Design execution runner.

```bash
sudo -u instance1 /bin/bash -c '
  set -euo pipefail
  cd /srv/cognelo/instance1/deployments/cognelo-0.6.0
  set -a
  . ./.env
  set +a
  npm ci --include=dev
  npm run db:generate
  npm run lint
  npm run typecheck
  NEXT_PUBLIC_API_URL="http://localhost:3001" npm test

  storage_target=$(readlink -f storage)
  test "$storage_target" = /srv/cognelo/instance1/shared/storage
  test ! -e storage.persistent-link
  test ! -e storage.build-empty
  mv storage storage.persistent-link
  restore_storage() {
    mv storage storage.build-empty
    mv storage.persistent-link storage
    rmdir storage.build-empty
  }
  trap restore_storage EXIT
  mkdir storage
  NEXT_PUBLIC_COGNELO_VERSION="0.6.0" npm run build
'
```

`--include=dev` is required for ESLint, TypeScript, and the test/build tooling. The final build uses the production `NEXT_PUBLIC_API_URL` loaded from `.env`; that URL is embedded in the browser bundle. Set `NEXT_PUBLIC_COGNELO_VERSION` to the immutable release version without the `cognelo-` tag prefix. This prevents expected Prisma generation changes in the deployment worktree from making the compiled release label incorrectly include `-dirty`.

The temporary empty `storage` directory is build-only. Turbopack traces the
whole project for some server imports and can reject uploaded-file symlinks
that resolve outside the deployment worktree. The exit trap restores the
persistent instance symlink before the command returns and removes the empty
directory; it neither copies nor changes `/srv/cognelo/instance1/shared/storage`.
Re-run `readlink -f` and verify the instance-specific target before migrating.

Do not continue if installation, generation, lint, tests, type checking, or the build fails. Fix the release and publish a new tag rather than editing the production worktree.

## 3. Update the sandbox only when the private upgrade checklist requires it

The private upgrade checklist must say either **Sandbox update: None** or provide the exact required procedure. Skip this section when it says `None`.

Release authors must evaluate every registered core feature, activity plugin, content-type plugin, shared SDK, runner, infrastructure template, and external-service contract. The upgrade process deliberately does not maintain a hardcoded list of plugin paths: such a list would become incomplete as soon as another plugin adds a sandbox or external dependency.

The commands below are an example for the currently deployed web-design runner. If a release adds or changes another sandbox service, plugin-owned worker, or external dependency, its private upgrade checklist must provide the complete service-specific procedure instead of asking the operator to adapt this example.

If the private upgrade checklist requires an update to the existing web-design runner, use the sandbox server to fetch the same new tag and create its worktree:

Before changing sandbox runtime configuration, preserve its environment and Judge0 configuration in a root-only directory on the sandbox host:

```bash
sudo install -d -m 0700 \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0-sandbox

sudo cp --preserve=mode,ownership,timestamps \
  /srv/cognelo-sandboxes/instance1/runtime/.env \
  /srv/cognelo-sandboxes/instance1/runtime/judge0.conf \
  /srv/cognelo-sandboxes/instance1/runtime/sandbox.compose.yml \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0-sandbox/

if sudo test -f /srv/cognelo-sandboxes/instance1/runtime/configure-languages.sql; then
  sudo cp --preserve=mode,ownership,timestamps \
    /srv/cognelo-sandboxes/instance1/runtime/configure-languages.sql \
    /var/backups/cognelo/instance1/pre-cognelo-0.6.0-sandbox/
fi
```

These files can contain secrets. Protect and encrypt them like the application `.env` backup.

Fetch and create the new sandbox worktree:

```bash
sudo -u cognelo-sandbox-instance1 git \
  -C /srv/cognelo-sandboxes/instance1/repository/source \
  fetch --prune --tags

sudo -u cognelo-sandbox-instance1 git \
  -C /srv/cognelo-sandboxes/instance1/repository/source \
  worktree add --detach \
  /srv/cognelo-sandboxes/instance1/deployments/cognelo-0.6.0 \
  refs/tags/cognelo-0.6.0
```

Build the matching runner image:

```bash
cd /srv/cognelo-sandboxes/instance1/deployments/cognelo-0.6.0
sudo docker build \
  --file infra/production/web-design-runner.Dockerfile \
  --tag cognelo/web-design-runner:cognelo-0.6.0 \
  .
```

For the first upgrade to authenticated runners, add a fresh `WEB_DESIGN_RUNNER_TOKEN` (at least 32 characters, generated with `openssl rand -hex 32`) to the private sandbox runtime `.env`, and configure the same `Authorization` / `Bearer <credential>` in **Settings → Runners**. Keep the value available in the operator shell for authenticated health checks. Later upgrades retain it. Existing unscoped login cookies require users to sign in again after session-purpose enforcement. Revalidate existing Web Design tests against the [supported command subset](../packages/plugin-activities/plugin-web-design-coding-exercises/docs/REFERENCE.md#runner-command-contract).

Update the runner image in `/srv/cognelo-sandboxes/instance1/runtime/.env`:

```dotenv
WEB_DESIGN_RUNNER_IMAGE=cognelo/web-design-runner:cognelo-0.6.0
```

Copy `infra/production/playwright-seccomp.json` from this release to the runtime `seccomp_profile.json` before recreating the runner. It allows the inner Chromium sandbox to use `chroot` while outer container capabilities remain dropped.

Validate and restart the runner:

```bash
cd /srv/cognelo-sandboxes/instance1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d --no-deps web-design-runner
curl --fail -H "Authorization: Bearer ${WEB_DESIGN_RUNNER_TOKEN}" http://10.80.0.2:3456/health
```

If the private upgrade checklist specifies changes to `sandbox.compose.yml`, `judge0.conf`, Playwright, Judge0, Redis, the sandbox PostgreSQL version, seccomp, ports, or WireGuard, follow those exact release-specific steps. Do not overwrite the persistent runtime `.env` or `judge0.conf`, because they contain instance-specific settings and secrets. Do not use mutable image tags such as `latest`.

When a release changes the Judge0 language configuration, rebuild/select the hardened wrapper with its embedded SQL, then copy both versioned files from that release, validate them, stop workers, run the configuration once, and recreate the workers only after it succeeds:

```bash
sudo install -m 0644 \
  /srv/cognelo-sandboxes/instance1/deployments/cognelo-0.6.0/infra/production/sandbox.compose.yml \
  /srv/cognelo-sandboxes/instance1/runtime/sandbox.compose.yml
sudo install -m 0644 \
  /srv/cognelo-sandboxes/instance1/deployments/cognelo-0.6.0/infra/judge0/configure-languages.sql \
  /srv/cognelo-sandboxes/instance1/runtime/configure-languages.sql

cd /srv/cognelo-sandboxes/instance1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml stop judge0-workers
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d --force-recreate judge0-language-config judge0-workers
sudo docker compose --env-file .env -f sandbox.compose.yml \
  ps -a judge0-language-config judge0-workers
```

The configuration is idempotent. Compose waits for its successful exit before recreating the workers. `judge0-language-config` must show `Exited (0)` and its logs must show every active C/C++ runtime with `-pthread -lm -ldl -lrt`. Complete the Python and C Judge0 smoke tests from the initial deployment runbook in isolated preprod before deploying this change; production checks remain read-only.

### First upgrade to queued, hardened Judge0

This change requires a coordinated maintenance window: the old Cognelo client uses synchronous execution, which the new image refuses. Back up the application, runner configuration, and any retained Judge0 database first. Stop application/API background traffic before changing the stack; leave the private PostgreSQL service available for credential rotation. Do not use the local-development credential helper on production.

1. Build `cognelo/judge0-hardened:<new-tag>` with `infra/production/judge0-hardened.Dockerfile` and the approved `JUDGE0_BASE_IMAGE=judge0/judge0:1.13.1`, as shown in [initial deployment](DEPLOYMENT_UBUNTU_APACHE.md#144-build-the-pinned-execution-images). Build the matching Web Design image too.
2. Stop `judge0-server`, `judge0-workers`, and `judge0-redis`. Upstream startup logs may have contained the four Judge0 service credentials. Keep any required evidence in restricted incident storage; rotate `AUTHN_TOKEN`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and `SECRET_KEY_BASE`. Update the existing PostgreSQL role interactively using `docker compose --env-file .env -f sandbox.compose.yml exec judge0-db psql -U judge0 -d postgres` and `\password judge0`, then store the matching password in protected `judge0.conf`. Do not remove database volumes or merely change the config without updating the existing role.
3. Copy the new Compose template and language SQL. Preserve instance-specific settings/secrets, set `ENABLE_WAIT_RESULT=false` in `judge0.conf`, and set runtime `JUDGE0_IMAGE=cognelo/judge0-hardened:<new-tag>` plus the new `WEB_DESIGN_RUNNER_IMAGE`. Pull only `judge0-db`, `judge0-redis`, and `judge0-language-config` (PostgreSQL 16.15 / Redis 7.2.16). Both Judge0 services must use the locally built wrapper; only workers remain privileged, and the API drops all capabilities with `no-new-privileges`. Retain the worker’s private cgroup namespace and the template’s separate compilation ceilings; ordinary execution defaults stay bounded.
4. Validate with `docker compose config --quiet`, recreate the private databases and execution services with the preserved volumes, and require `judge0-language-config` to exit successfully. The queued Python/C smoke tests in the initial runbook must already have passed in isolated preprod. Verify `/api/environment` is mode `0600`, current logs contain none of the rotated values, and the old authentication token returns 401 on a read-only endpoint.
5. Run `npm run db:migrate:all` and activate the matching Cognelo release during the same window. Update the encrypted Judge0 token through **Settings → Runners** using restricted administrator access before restoring learner traffic; disable per-process/thread fallback on this cgroup-capable host, and run both runner capability tests plus a representative program in every required language. The GitHub plugin migration `202610250020_github_url_credentials` strips legacy URL userinfo and invalidates its derived index; Core migration `202610250030_legacy_material_urls` performs the same cleanup for course, section, and retained subject material URLs and clears unsupported URL schemes. Rotate any real credential that had been embedded in these URLs.
6. Keep rollback artifacts for the application, wrapper image, configuration, and database together. An older synchronous client is incompatible with the queued-only stack; rehearse rollback as a coordinated pair. Credentials already exposed in old logs must stay rotated.

The wrapper fixes startup secret handling and API privilege separation, not all upstream Judge0 OS/language dependencies. Retain the dedicated disposable sandbox host, authenticated restricted listeners, internal network, and blocked egress. Record scan applicability and remaining upstream advisories in the private release checklist.

Shared Markdown also stops activating attributed raw HTML: review older materials that used HTML styles/forms and use ordinary Markdown/editor formatting. The stored source is preserved. Ordinary Markdown links/images/tables, attribute-free formatting, and bounded untrusted math remain supported.

## 4. Back up the database

Confirm the protected backup directory created before environment changes still exists:

```bash
sudo install -d -m 0700 \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0

sudo test -f \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0/instance1.env
```

Stop the web and API services so no user or background job can change data during the backup and migration:

```bash
sudo systemctl stop instance1-web instance1-api
systemctl is-active instance1-web instance1-api
```

Both should report `inactive`.

Create the PostgreSQL dump. The root shell owns the output file while `pg_dump` connects as PostgreSQL's administrative account:

```bash
sudo sh -c '
  umask 077
  sudo -u postgres pg_dump --format=custom cognelo_instance1 \
    > /var/backups/cognelo/instance1/pre-cognelo-0.6.0/database.dump
'
```

Verify the dump before migrating:

```bash
sudo pg_restore --list \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0/database.dump \
  | head -n 20

sudo sha256sum \
  /var/backups/cognelo/instance1/pre-cognelo-0.6.0/database.dump \
  | sudo tee \
    /var/backups/cognelo/instance1/pre-cognelo-0.6.0/database.dump.sha256
```

The upgrade does not copy `shared/storage`. It remains untouched at `/srv/cognelo/instance1/shared/storage`. Confirm the new deployment still points there:

```bash
test "$(readlink -f /srv/cognelo/instance1/deployments/cognelo-0.6.0/storage)" = \
  /srv/cognelo/instance1/shared/storage
```

If the installation's normal storage backup or filesystem snapshot is overdue, take it through the existing backup system before continuing. Do not create an extra full copy merely for every routine tagged upgrade.

When the private upgrade checklist introduces rich-text media, set `MEDIA_STORAGE_ROOT="./storage/media"` (or retain the default), verify the instance account owns `shared/storage`, and install/enable the instance-specific media garbage-collection service and timer from the initial deployment runbook. Run `npm run media:gc` first and review its counts; never delete files directly from the content-addressed tree.

## 5. Run migrations and activate the release

With both services still stopped, run all core and plugin migrations from the new release. The combined command applies both activity-plugin and content-type-plugin manifest migrations, including new private tables for already activated plugins (such as Link internal summaries):

```bash
sudo -u instance1 /bin/bash -c '
  set -euo pipefail
  cd /srv/cognelo/instance1/deployments/cognelo-0.6.0
  set -a
  . ./.env
  set +a
  npm run db:migrate:all
'
```

Do not start either release if migration fails. Preserve the output and restore the database as described under **Rollback after migrations** below.

After successful migrations, switch `current` to the new worktree:

```bash
sudo ln -sfn \
  /srv/cognelo/instance1/deployments/cognelo-0.6.0 \
  /srv/cognelo/instance1/current
sudo chown -h instance1:instance1 /srv/cognelo/instance1/current
readlink -f /srv/cognelo/instance1/current
```

The last command must print:

```text
/srv/cognelo/instance1/deployments/cognelo-0.6.0
```

Start the API first and wait for database health:

```bash
sudo systemctl start instance1-api
curl --fail --retry 12 --retry-delay 5 \
  http://127.0.0.1:3101/api/health
```

If health fails, inspect the API log before starting web:

```bash
sudo journalctl -u instance1-api -n 300 --no-pager
```

Once API health passes, start web:

```bash
sudo systemctl start instance1-web
curl --fail --retry 12 --retry-delay 5 --head \
  http://127.0.0.1:3100/
```

Verify the public site:

```bash
curl --fail https://instance1.example.com/api/health
curl --fail --head https://instance1.example.com/
sudo systemctl status instance1-api instance1-web --no-pager
```

## 6. Verify the deployed release without test data

Functional acceptance belongs in the isolated preprod rehearsal: sign-in, existing content/uploads, plugin registration, representative submissions/grades, and any relevant Judge0/Web Design execution. Do not repeat those workflows against production or add disposable production records.

On production, confirm the active immutable tag/version, public and loopback health, expected service state, and recent startup logs. Read-only integrity comparisons may verify that the upgrade preserved existing records. Never treat deployment authorization as permission to run browser tests or create synthetic data; see the [standing boundary](#production-validation-boundary).

```bash
sudo journalctl -u instance1-api --since '30 minutes ago' --no-pager
sudo journalctl -u instance1-web --since '30 minutes ago' --no-pager
sudo tail -n 200 /var/log/apache2/instance1-cognelo-error.log
sudo journalctl -u instance1-api --since '30 minutes ago' --no-pager | grep 'auth_session_rejected' || true
```

Keep the old worktree and the database dump until the new release has been accepted.

## 7. Rollback

### Code-only rollback

Use a code-only rollback only if migrations were not run, the release contained no database migrations, or the release explicitly confirms that the old code is compatible with the migrated database.

```bash
sudo systemctl stop instance1-web instance1-api

sudo ln -sfn \
  /srv/cognelo/instance1/deployments/cognelo-0.5.0 \
  /srv/cognelo/instance1/current
sudo chown -h instance1:instance1 /srv/cognelo/instance1/current

sudo systemctl start instance1-api
curl --fail --retry 12 --retry-delay 5 \
  http://127.0.0.1:3101/api/health
sudo systemctl start instance1-web
curl --fail https://instance1.example.com/api/health
```

If the sandbox runner changed, restore the previous `WEB_DESIGN_RUNNER_IMAGE` in its runtime `.env`, run `docker compose config --quiet`, recreate the runner, and repeat its health test.

### Rollback after migrations

If migrations changed the schema and backward compatibility is not guaranteed, restore the pre-upgrade database before restarting the old tag.

Stop services:

```bash
sudo systemctl stop instance1-web instance1-api
```

Terminate connections, recreate only the explicit instance database, and restore the dump:

```bash
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cognelo_instance1' AND pid <> pg_backend_pid();"

sudo -u postgres dropdb --if-exists cognelo_instance1
sudo -u postgres createdb \
  --owner=cognelo_instance1 \
  --encoding=UTF8 \
  cognelo_instance1

sudo sh -c '
  sudo -u postgres pg_restore \
    --exit-on-error \
    --no-owner \
    --dbname=cognelo_instance1 \
    < /var/backups/cognelo/instance1/pre-cognelo-0.6.0/database.dump
'
```

Before `dropdb`, verify the database name character-for-character. This is the only intentionally destructive part of rollback.

The storage directory was never replaced or copied, so no storage restore is required for an ordinary upgrade. If the new release itself modified uploaded files in an incompatible way, use the installation's normal storage backup/snapshot according to that release's notes.

Switch back to the old release and restart:

```bash
sudo ln -sfn \
  /srv/cognelo/instance1/deployments/cognelo-0.5.0 \
  /srv/cognelo/instance1/current
sudo chown -h instance1:instance1 /srv/cognelo/instance1/current

sudo systemctl start instance1-api
curl --fail --retry 12 --retry-delay 5 \
  http://127.0.0.1:3101/api/health
sudo systemctl start instance1-web
curl --fail https://instance1.example.com/api/health
```

Repeat read-only health, version, and log checks after rollback. Do not create production test data.

## 8. Clean up later

Do not remove the previous worktree immediately. After the acceptance period and after confirming backups are retained, remove an obsolete worktree through Git:

```bash
sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  worktree remove \
  /srv/cognelo/instance1/deployments/cognelo-0.5.0

sudo -u instance1 git -C /srv/cognelo/instance1/repository \
  worktree prune
```

Never remove `/srv/cognelo/instance1/shared`, its `.env`, or its `storage` directory during release cleanup.

## Quick checklist

- [ ] The supplied current-production dump was freshly restored into isolated pre-production.
- [ ] The exact current commit passed all core and plugin migrations and automated checks against that clone.
- [ ] The candidate passed required local/preprod checks, and user release/deployment authorization is recorded, including any satisfied conditional authorization.
- [ ] The immutable tag resolves to the approved, unchanged commit.
- [ ] Current tag and health are confirmed.
- [ ] New immutable tag is fetched and verified.
- [ ] Release changes, migrations, and environment additions are reviewed.
- [ ] Storage layout, permissions, backup requirements, and media-maintenance changes are reviewed.
- [ ] Current application `.env` is backed up with root-only permissions before it is edited.
- [ ] New detached worktree is linked to the existing shared `.env` and storage.
- [ ] Dependencies, Prisma generation, lint, typecheck, tests, and production build pass before downtime.
- [ ] Sandbox is updated only if the release changes it.
- [ ] Sandbox runtime configuration is backed up before any sandbox edit.
- [ ] Web and API are stopped.
- [ ] PostgreSQL dump is created and verified.
- [ ] Migrations complete successfully.
- [ ] `current` points to the new tag.
- [ ] API health passes before web starts.
- [ ] Public health, deployed version, and read-only production checks pass; functional checks stayed in local/preprod and no production test data was created.
- [ ] Old worktree and database dump remain available through the acceptance period.

### Instance timezone migration

When upgrading to a release containing `202610210001_application_timezone`, the combined migration command adds the instance setting with a `UTC` default. After startup, an administrator should select the intended timezone under **Settings → Date and time** before users resume scheduling. Existing UTC deadlines and attempts are not shifted. Open browser pages must reload to adopt the new display zone. Keep the host clock synchronized; no OS timezone change is needed. See [application time](APPLICATION_TIME.md).
