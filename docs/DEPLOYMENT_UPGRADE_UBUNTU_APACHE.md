# Upgrading Cognelo on Ubuntu with Apache

This guide upgrades an existing Cognelo installation created with [DEPLOYMENT_UBUNTU_APACHE.md](DEPLOYMENT_UBUNTU_APACHE.md) from one immutable Git tag to another.

The examples upgrade instance `app1` from `cognelo-0.5.0` to `cognelo-0.6.0`. Replace the instance name, paths, ports, database, and tags with the values used by the real installation.

The normal upgrade does **not** copy `/srv/cognelo/app1/shared` or its potentially large `storage` directory. Every deployment worktree links to the same persistent `.env` and `storage`. This procedure makes a small, protected copy of the application `.env` and a PostgreSQL database dump. Uploaded storage should already be covered by the installation's normal off-host backup or snapshot policy.

## Before starting

You need:

- SSH and sudo access to the application server;
- the existing repository at `/srv/cognelo/app1/repository`;
- the current release under `/srv/cognelo/app1/current`;
- enough disk space for one additional release worktree and its dependencies/build output; and
- a new immutable Git tag that has already passed CI.

Never build over `current`, deploy a branch such as `main`, run `npm run db:seed`, or remove the previous release until the new release has been accepted.

## Mandatory pre-production release gate

Do not create a tag or production release until the exact current commit has passed a pre-production upgrade rehearsal and the designated approver has explicitly accepted it. The release process is:

1. the designated approver supplies a fresh, protected dump of the currently deployed production database;
2. restore that dump into an isolated pre-production database;
3. deploy the exact current commit to pre-production and run its complete `npm run db:migrate:all` path, including core and plugin migrations, without errors;
4. pass automated tests, production builds, service health checks, and migration-log review;
5. receive manual visual and workflow testing by the designated approver; and
6. only after explicit approval, create the immutable tag and GitHub Release from that unchanged commit.

Never reuse a database that was migrated by an earlier candidate: restore the supplied production dump before every rehearsal. A successful CI run, an empty migration set, or automated smoke tests do not replace manual approval. Record the source production version, candidate commit, migration log, test date, and approver in the release record. The release tag must resolve to the approved commit. If the commit changes after approval, repeat the complete rehearsal with a fresh restore and obtain approval again.

Check the current release and service health:

```bash
readlink -f /srv/cognelo/app1/current
sudo -u app1 git -C /srv/cognelo/app1/current \
  describe --tags --exact-match

systemctl is-active app1-api app1-web apache2 postgresql
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://app1.cognelo.org/api/health
```

Stop and investigate if the current release is not the expected old tag or the instance is unhealthy before the upgrade.

## 1. Read the release notes, then fetch the tag

Every production tag must have published GitHub Release notes with an **Upgrade from the previous release** section. Release authors—not production operators—are responsible for reviewing the code changes and identifying everything that affects an upgrade.

The upgrade section must state:

- the exact previous tag(s) from which the instructions apply;
- whether downtime is required and its expected duration;
- whether the normal PostgreSQL backup in this guide is sufficient;
- all database migrations, whether they run automatically, their expected duration, and whether they are backward-compatible;
- every environment variable added, changed, renamed, or removed, with exact operator action;
- every manual command required on the application host;
- whether systemd, Apache, Ubuntu packages, Node.js, PostgreSQL, or filesystem permissions must change;
- whether the sandbox must be updated and the exact runner, Compose, Judge0, Redis, PostgreSQL, seccomp, or WireGuard steps;
- plugin activation, deactivation, backup/restore, or data-conversion requirements;
- required post-migration/backfill jobs and how to verify completion;
- release-specific smoke tests; and
- whether code-only rollback is safe or a database restore is required.

Each category must contain explicit instructions or the word **None**. “Review the diff,” “update configuration as needed,” or similar language is not an acceptable substitute.

Use [RELEASE_NOTES_TEMPLATE.md](RELEASE_NOTES_TEMPLATE.md) when publishing a release. If the GitHub Release is missing, its upgrade section is incomplete, or it does not explicitly support the currently installed tag, **stop**. Do not ask the production operator to infer upgrade requirements from commits or changed files. Have the release author correct the notes before deployment.

Read the complete release notes before connecting to production. Copy the release-specific upgrade checklist into the maintenance record and check off each instruction as it is performed.

Before applying any environment changes, create the protected upgrade backup directory and preserve the current application `.env`:

```bash
sudo install -d -m 0700 \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0

sudo cp --preserve=mode,ownership,timestamps \
  /srv/cognelo/app1/shared/.env \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0/app1.env

sudo chmod 0600 \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0/app1.env
```

This file contains production secrets. Keep the backup root-only, encrypt it before off-host transfer, and never attach it to logs, tickets, or release notes.

Fetch repository updates without changing the active release:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  fetch --prune --tags

sudo -u app1 git -C /srv/cognelo/app1/repository \
  rev-parse --verify 'refs/tags/cognelo-0.6.0^{commit}'
```

If production tags are signed, verify the tag:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  verify-tag cognelo-0.6.0
```

Confirm that the fetched tag matches the release notes and record its commit:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  rev-list -n 1 cognelo-0.6.0
```

Perform the environment and manual actions listed in the release notes. If a new environment value is required, add it manually to `/srv/cognelo/app1/shared/.env`. Do not replace the production file with `.env.example`, and do not rotate existing secrets as part of a routine upgrade unless the release notes explicitly require it.

## 2. Create and build the new release

Make sure the destination does not already exist:

```bash
test ! -e /srv/cognelo/app1/deployments/cognelo-0.6.0
```

Create a detached worktree at the exact tag:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree add --detach \
  /srv/cognelo/app1/deployments/cognelo-0.6.0 \
  refs/tags/cognelo-0.6.0
```

Link the persistent environment and storage. These commands create symlinks; they do not copy the shared data:

```bash
sudo -u app1 ln -s ../../shared/.env \
  /srv/cognelo/app1/deployments/cognelo-0.6.0/.env

sudo -u app1 ln -s ../../shared/storage \
  /srv/cognelo/app1/deployments/cognelo-0.6.0/storage
```

Verify the links before continuing:

```bash
readlink -f /srv/cognelo/app1/deployments/cognelo-0.6.0/.env
readlink -f /srv/cognelo/app1/deployments/cognelo-0.6.0/storage
```

They must resolve to:

```text
/srv/cognelo/app1/shared/.env
/srv/cognelo/app1/shared/storage
```

Install, generate, test, and build while the old release remains online:

```bash
sudo -u app1 /bin/bash -c '
  set -euo pipefail
  cd /srv/cognelo/app1/deployments/cognelo-0.6.0
  set -a
  . ./.env
  set +a
  npm ci --include=dev
  npm run db:generate
  npm run typecheck
  NEXT_PUBLIC_API_URL="http://localhost:3001" npm test
  npm run build
'
```

`--include=dev` is required for TypeScript and the test/build tooling. The final build uses the production `NEXT_PUBLIC_API_URL` loaded from `.env`; that URL is embedded in the browser bundle.

Do not continue if installation, generation, tests, type checking, or the build fails. Fix the release and publish a new tag rather than editing the production worktree.

## 3. Update the sandbox only when the release notes require it

The release notes must say either **Sandbox update: None** or provide the exact required procedure. Skip this section when they say `None`.

Release authors must evaluate every registered core feature, activity plugin, content-type plugin, shared SDK, runner, infrastructure template, and external-service contract. The upgrade process deliberately does not maintain a hardcoded list of plugin paths: such a list would become incomplete as soon as another plugin adds a sandbox or external dependency.

The commands below are an example for the currently deployed web-design runner. If a release adds or changes another sandbox service, plugin-owned worker, or external dependency, its release notes must provide the complete service-specific procedure instead of asking the operator to adapt this example.

If the release notes require an update to the existing web-design runner, use the sandbox server to fetch the same new tag and create its worktree:

Before changing sandbox runtime configuration, preserve its environment and Judge0 configuration in a root-only directory on the sandbox host:

```bash
sudo install -d -m 0700 \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0-sandbox

sudo cp --preserve=mode,ownership,timestamps \
  /srv/cognelo-sandboxes/app1/runtime/.env \
  /srv/cognelo-sandboxes/app1/runtime/judge0.conf \
  /srv/cognelo-sandboxes/app1/runtime/sandbox.compose.yml \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0-sandbox/
```

These files can contain secrets. Protect and encrypt them like the application `.env` backup.

Fetch and create the new sandbox worktree:

```bash
sudo -u cognelo-sandbox-app1 git \
  -C /srv/cognelo-sandboxes/app1/repository/source \
  fetch --prune --tags

sudo -u cognelo-sandbox-app1 git \
  -C /srv/cognelo-sandboxes/app1/repository/source \
  worktree add --detach \
  /srv/cognelo-sandboxes/app1/deployments/cognelo-0.6.0 \
  refs/tags/cognelo-0.6.0
```

Build the matching runner image:

```bash
cd /srv/cognelo-sandboxes/app1/deployments/cognelo-0.6.0
sudo docker build \
  --file infra/production/web-design-runner.Dockerfile \
  --tag cognelo/web-design-runner:cognelo-0.6.0 \
  .
```

Edit only the runner image in `/srv/cognelo-sandboxes/app1/runtime/.env`:

```dotenv
WEB_DESIGN_RUNNER_IMAGE=cognelo/web-design-runner:cognelo-0.6.0
```

Validate and restart the runner:

```bash
cd /srv/cognelo-sandboxes/app1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d --no-deps web-design-runner
curl --fail http://10.80.0.2:3456/health
```

If the release notes specify changes to `sandbox.compose.yml`, `judge0.conf`, Playwright, Judge0, Redis, the sandbox PostgreSQL version, seccomp, ports, or WireGuard, follow those exact release-specific steps. Do not overwrite the persistent runtime `.env` or `judge0.conf`, because they contain instance-specific settings and secrets. Do not use mutable image tags such as `latest`.

## 4. Back up the database

Confirm the protected backup directory created before environment changes still exists:

```bash
sudo install -d -m 0700 \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0

sudo test -f \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0/app1.env
```

Stop the web and API services so no user or background job can change data during the backup and migration:

```bash
sudo systemctl stop app1-web app1-api
systemctl is-active app1-web app1-api
```

Both should report `inactive`.

Create the PostgreSQL dump. The root shell owns the output file while `pg_dump` connects as PostgreSQL's administrative account:

```bash
sudo sh -c '
  umask 077
  sudo -u postgres pg_dump --format=custom cognelo_app1 \
    > /var/backups/cognelo/app1/pre-cognelo-0.6.0/database.dump
'
```

Verify the dump before migrating:

```bash
sudo pg_restore --list \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0/database.dump \
  | head -n 20

sudo sha256sum \
  /var/backups/cognelo/app1/pre-cognelo-0.6.0/database.dump \
  | sudo tee \
    /var/backups/cognelo/app1/pre-cognelo-0.6.0/database.dump.sha256
```

The upgrade does not copy `shared/storage`. It remains untouched at `/srv/cognelo/app1/shared/storage`. Confirm the new deployment still points there:

```bash
test "$(readlink -f /srv/cognelo/app1/deployments/cognelo-0.6.0/storage)" = \
  /srv/cognelo/app1/shared/storage
```

If the installation's normal storage backup or filesystem snapshot is overdue, take it through the existing backup system before continuing. Do not create an extra full copy merely for every routine tagged upgrade.

## 5. Run migrations and activate the release

With both services still stopped, run all core and plugin migrations from the new release:

```bash
sudo -u app1 /bin/bash -c '
  set -euo pipefail
  cd /srv/cognelo/app1/deployments/cognelo-0.6.0
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
  /srv/cognelo/app1/deployments/cognelo-0.6.0 \
  /srv/cognelo/app1/current
sudo chown -h app1:app1 /srv/cognelo/app1/current
readlink -f /srv/cognelo/app1/current
```

The last command must print:

```text
/srv/cognelo/app1/deployments/cognelo-0.6.0
```

Start the API first and wait for database health:

```bash
sudo systemctl start app1-api
curl --fail --retry 12 --retry-delay 5 \
  http://127.0.0.1:3101/api/health
```

If health fails, inspect the API log before starting web:

```bash
sudo journalctl -u app1-api -n 300 --no-pager
```

Once API health passes, start web:

```bash
sudo systemctl start app1-web
curl --fail --retry 12 --retry-delay 5 --head \
  http://127.0.0.1:3100/
```

Verify the public site:

```bash
curl --fail https://app1.cognelo.org/api/health
curl --fail --head https://app1.cognelo.org/
sudo systemctl status app1-api app1-web --no-pager
```

## 6. Smoke-test the release

Complete a short production smoke test:

1. Sign in as an administrator through the public HTTPS URL.
2. Open an existing subject, activity bank, course, and section.
3. Confirm existing uploaded files can still be downloaded.
4. Confirm Settings → Plugins shows the expected activation state.
5. Submit one designated test activity and confirm its result reaches the gradebook.
6. If enabled, run one small Judge0 coding exercise.
7. If enabled, run one small Playwright web-design exercise.
8. Check recent logs for recurring errors.

```bash
sudo journalctl -u app1-api --since '30 minutes ago' --no-pager
sudo journalctl -u app1-web --since '30 minutes ago' --no-pager
sudo tail -n 200 /var/log/apache2/app1-cognelo-error.log
```

Keep the old worktree and the database dump until the new release has been accepted.

## 7. Rollback

### Code-only rollback

Use a code-only rollback only if migrations were not run, the release contained no database migrations, or the release explicitly confirms that the old code is compatible with the migrated database.

```bash
sudo systemctl stop app1-web app1-api

sudo ln -sfn \
  /srv/cognelo/app1/deployments/cognelo-0.5.0 \
  /srv/cognelo/app1/current
sudo chown -h app1:app1 /srv/cognelo/app1/current

sudo systemctl start app1-api
curl --fail --retry 12 --retry-delay 5 \
  http://127.0.0.1:3101/api/health
sudo systemctl start app1-web
curl --fail https://app1.cognelo.org/api/health
```

If the sandbox runner changed, restore the previous `WEB_DESIGN_RUNNER_IMAGE` in its runtime `.env`, run `docker compose config --quiet`, recreate the runner, and repeat its health test.

### Rollback after migrations

If migrations changed the schema and backward compatibility is not guaranteed, restore the pre-upgrade database before restarting the old tag.

Stop services:

```bash
sudo systemctl stop app1-web app1-api
```

Terminate connections, recreate only the explicit instance database, and restore the dump:

```bash
sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cognelo_app1' AND pid <> pg_backend_pid();"

sudo -u postgres dropdb --if-exists cognelo_app1
sudo -u postgres createdb \
  --owner=cognelo_app1 \
  --encoding=UTF8 \
  cognelo_app1

sudo sh -c '
  sudo -u postgres pg_restore \
    --exit-on-error \
    --no-owner \
    --dbname=cognelo_app1 \
    < /var/backups/cognelo/app1/pre-cognelo-0.6.0/database.dump
'
```

Before `dropdb`, verify the database name character-for-character. This is the only intentionally destructive part of rollback.

The storage directory was never replaced or copied, so no storage restore is required for an ordinary upgrade. If the new release itself modified uploaded files in an incompatible way, use the installation's normal storage backup/snapshot according to that release's notes.

Switch back to the old release and restart:

```bash
sudo ln -sfn \
  /srv/cognelo/app1/deployments/cognelo-0.5.0 \
  /srv/cognelo/app1/current
sudo chown -h app1:app1 /srv/cognelo/app1/current

sudo systemctl start app1-api
curl --fail --retry 12 --retry-delay 5 \
  http://127.0.0.1:3101/api/health
sudo systemctl start app1-web
curl --fail https://app1.cognelo.org/api/health
```

Repeat the smoke test after rollback.

## 8. Clean up later

Do not remove the previous worktree immediately. After the acceptance period and after confirming backups are retained, remove an obsolete worktree through Git:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree remove \
  /srv/cognelo/app1/deployments/cognelo-0.5.0

sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree prune
```

Never remove `/srv/cognelo/app1/shared`, its `.env`, or its `storage` directory during release cleanup.

## Quick checklist

- [ ] The supplied current-production dump was freshly restored into isolated pre-production.
- [ ] The exact current commit passed all core and plugin migrations and automated checks against that clone.
- [ ] The candidate passed manual pre-production testing and the designated approver explicitly approved release.
- [ ] The immutable tag resolves to the approved, unchanged commit.
- [ ] Current tag and health are confirmed.
- [ ] New immutable tag is fetched and verified.
- [ ] Release changes, migrations, and environment additions are reviewed.
- [ ] Current application `.env` is backed up with root-only permissions before it is edited.
- [ ] New detached worktree is linked to the existing shared `.env` and storage.
- [ ] Dependencies, Prisma generation, typecheck, tests, and production build pass before downtime.
- [ ] Sandbox is updated only if the release changes it.
- [ ] Sandbox runtime configuration is backed up before any sandbox edit.
- [ ] Web and API are stopped.
- [ ] PostgreSQL dump is created and verified.
- [ ] Migrations complete successfully.
- [ ] `current` points to the new tag.
- [ ] API health passes before web starts.
- [ ] Public health and smoke tests pass.
- [ ] Old worktree and database dump remain available through the acceptance period.
