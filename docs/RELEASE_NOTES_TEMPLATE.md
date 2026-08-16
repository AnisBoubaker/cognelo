# Cognelo Release Notes Template

Use this template for every production GitHub Release. Replace every placeholder. Do not delete upgrade categories: write **None** when no action is required.

# Cognelo VERSION

Tag: `cognelo-X.Y.Z`  
Commit: `FULL_COMMIT_SHA`  
Release date: `YYYY-MM-DD`

## Highlights

- USER-FACING_CHANGE

## Fixed

- FIXED_BUG

## Upgrade from the previous release

These instructions apply when upgrading from `cognelo-A.B.C` to `cognelo-X.Y.Z`.

### Downtime

- Required: `Yes/No`
- Expected duration: `DURATION`
- Reason: `REASON`

### Required backup

- PostgreSQL dump: `Required/Not required`
- Application `.env` backup: `Required` (standard upgrade step)
- Additional storage snapshot: `None` or exact reason and procedure
- Sandbox runtime configuration backup: `None` or `Required` when sandbox configuration changes
- Other backup: `None` or exact procedure

### Database migrations

- Automatic migrations run by `npm run db:migrate:all`: `None` or exact migration names/purpose
- Expected duration and locking impact: `DETAILS`
- Required free disk space: `DETAILS`
- Backward-compatible with the previous application tag: `Yes/No`
- If migration fails: `EXACT RECOVERY INSTRUCTION`

### Environment variables

- Added: `None` or `NAME` plus purpose, required value source, and exact action
- Changed: `None` or exact old/new semantics and action
- Renamed: `None` or exact old/new names and action
- Removed: `None` or exact removal timing/action

Never include actual production secrets in release notes.

### Application-host manual steps

`None` or numbered, copy-ready commands with the required user, directory, and timing (before/after migration and before/after restart).

### Host and service configuration

- Node.js/npm: `None` or required version/action
- Ubuntu packages: `None` or exact packages/action
- PostgreSQL: `None` or exact version/configuration/action
- systemd: `None` or exact unit/drop-in changes and reload timing
- Apache/TLS: `None` or exact changes and validation commands
- Filesystem paths/permissions: `None` or exact changes

### Sandbox

- Sandbox update: `None` or `Required`
- Playwright runner image: `None` or exact new tag/build command
- Compose template: `None` or exact merge/restart procedure
- Judge0: `None` or exact image/config/migration procedure
- Redis/sandbox PostgreSQL: `None` or exact stateful upgrade procedure
- Seccomp/WireGuard/firewall/ports: `None` or exact changes
- Other plugin-owned workers, sandbox services, or external dependencies: `None` or complete service-specific procedure
- Required sandbox smoke tests: `None` or exact commands/results

### Plugins

- Activation/deactivation changes: `None` or exact actions
- Plugin migrations/data conversions: `None` or exact actions
- Backup/restore implications: `None` or exact actions

### Post-upgrade jobs

`None` or exact commands/UI actions, expected duration, progress check, completion criteria, and retry behavior.

### Release-specific smoke tests

In addition to the standard upgrade guide:

1. `TEST_AND_EXPECTED_RESULT`

### Rollback

- Code-only rollback safe after migrations: `Yes/No`
- Database restore required: `Yes/No and under which conditions`
- Sandbox rollback required: `None` or exact steps
- Other release-specific rollback steps: `None` or exact steps

## Known issues

- `None` or ISSUE_LINK_AND_IMPACT

## Verification completed before release

- [ ] Full automated test suite passed.
- [ ] Production builds passed.
- [ ] A freshly supplied current-production dump was restored into isolated pre-production.
- [ ] The exact pre-tag candidate commit was deployed and tested against that clone.
- [ ] All core and plugin migrations completed successfully in pre-production; the migration log is retained.
- [ ] The designated approver manually tested the migrated pre-production environment and explicitly approved this release.
- [ ] This release tag resolves to the unchanged commit that received pre-production approval.
- [ ] Rollback behavior was tested or explicitly documented.
- [ ] Upgrade instructions were reviewed by someone other than their author.
