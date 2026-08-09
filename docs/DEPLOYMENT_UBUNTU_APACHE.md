# Deploying Cognelo on Ubuntu with Apache

This guide deploys one or more production Cognelo instances on a bare Ubuntu server. It uses:

- Apache as the public TLS reverse proxy;
- PostgreSQL installed directly on the host;
- two systemd-managed Node.js processes per Cognelo instance;
- one database, Unix account, storage directory, environment file, and port pair per instance;
- Docker only for optional code-execution sandboxes, preferably on a separate server or VM.

The examples use `instance1.cognelo.org` and the instance key `instance1`. Every example hostname, account, database, path, and port is a placeholder and must be replaced with values assigned to the target installation.

## 1. Recommended topology

```text
Internet
   |
   v
Apache :80/:443
   |-- /api/*  --> 127.0.0.1:3101  Cognelo API (systemd)
   `-- /*      --> 127.0.0.1:3100  Cognelo web (systemd)

Cognelo API
   |-- 127.0.0.1:5432/cognelo_instance1  host PostgreSQL
   |-- /srv/cognelo/instance1/shared/storage
   |-- private Judge0 endpoint             optional
   `-- private web-design runner endpoint  optional
```

Apache is the reference reverse proxy for this runbook. It provides the required HTTP reverse proxying, path-based routing, TLS termination, and upload handling. Nginx and Caddy can satisfy the same application requirements, but their configuration is outside the scope of this document. Next.js recommends placing a reverse proxy in front of a self-hosted Node server, and its Node deployment retains all framework features: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [Next.js deployment modes](https://nextjs.org/docs/app/getting-started/deploying).

PostgreSQL should run on the host for this topology. Docker remains appropriate for untrusted-code sandboxes because their dependency and isolation requirements are materially different from the web application.

## 2. Allocate instance-specific values

Keep a private inventory like this before starting:

| Setting | First instance | Second example |
|---|---:|---:|
| FQDN | `instance1.cognelo.org` | `instance2.cognelo.org` |
| Instance key | `instance1` | `instance2` |
| Unix account | `cognelo-instance1` | `cognelo-instance2` |
| Web port | `3100` | `3200` |
| API port | `3101` | `3201` |
| Database | `cognelo_instance1` | `cognelo_instance2` |
| Database role | `cognelo_instance1` | `cognelo_instance2` |
| Installation root | `/srv/cognelo/instance1` | `/srv/cognelo/instance2` |

Every instance needs a different port pair, database, database role, JWT secret, environment file, and storage directory. Do not reuse a web build between hostnames: `NEXT_PUBLIC_API_URL` is embedded when the web application is built.

## 3. Configure DNS

At the authoritative DNS server for `cognelo.org`, create:

```text
instance1.cognelo.org.  A     PUBLIC_IPV4_OF_UBUNTU_SERVER
```

Create an `AAAA` record only if the Ubuntu server has working public IPv6 and its firewall permits ports 80 and 443 over IPv6. The DNS server does not need to run on the Cognelo host.

Verify propagation from another machine:

```bash
dig +short A instance1.cognelo.org
dig +short AAAA instance1.cognelo.org
```

Do not request a TLS certificate until the `A`/`AAAA` answers point to the new server and inbound port 80 works.

## 4. Prepare Ubuntu

The guide assumes a supported Ubuntu LTS release and a sudo-capable operator account.

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y apache2 postgresql postgresql-contrib git curl ca-certificates build-essential openssl ufw
```

Install Node.js 24 LTS. Next.js 16 requires Node.js 20.9 or newer; Cognelo is currently developed and verified on Node 24. The following uses the NodeSource Ubuntu packages. Download the setup script before running it so it can be inspected:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
```

The Node requirement is documented by [Next.js](https://nextjs.org/docs/app/getting-started/installation); NodeSource publishes its supported Ubuntu package procedure in its [binary distributions repository](https://github.com/nodesource/distributions/blob/master/DEV_README.md). An established organization-managed Node package source may be substituted for NodeSource.

Enable only the public ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'
sudo ufw enable
sudo ufw status verbose
```

Never expose PostgreSQL, the Node ports, Judge0, or the web-design runner publicly. Ubuntu documents `ufw` as its default firewall frontend in the [Ubuntu Server firewall guide](https://ubuntu.com/server/docs/security-firewall/).

Enable the required Apache modules:

```bash
sudo a2enmod proxy proxy_http headers ssl rewrite
sudo systemctl enable --now apache2 postgresql
```

## 5. Create an isolated PostgreSQL database

Generate a URI-safe database password:

```bash
openssl rand -hex 32
```

Open PostgreSQL's administrative console:

```bash
sudo -u postgres psql
```

Run the following SQL, replacing `PASTE_DATABASE_PASSWORD`:

```sql
CREATE ROLE cognelo_instance1 LOGIN PASSWORD 'PASTE_DATABASE_PASSWORD';
CREATE DATABASE cognelo_instance1 OWNER cognelo_instance1 ENCODING 'UTF8';
REVOKE ALL ON DATABASE cognelo_instance1 FROM PUBLIC;
\connect cognelo_instance1
GRANT USAGE, CREATE ON SCHEMA public TO cognelo_instance1;
\q
```

Ubuntu's PostgreSQL package is sufficient. The PostgreSQL project documents both the Ubuntu package and its optional upstream Apt repository in [PostgreSQL Ubuntu downloads](https://www.postgresql.org/download/linux/ubuntu/).

Confirm that PostgreSQL listens only locally:

```bash
sudo -u postgres psql -tAc "SHOW listen_addresses;"
sudo ss -ltnp | grep 5432
```

`localhost` is the desired `listen_addresses` value for this single-host layout. Do not add a UFW rule for port 5432.

## 6. Create the instance account and directories

```bash
sudo useradd --system --create-home \
  --home-dir /srv/cognelo/instance1 \
  --shell /usr/sbin/nologin \
  cognelo-instance1

sudo install -d -m 0750 -o cognelo-instance1 -g cognelo-instance1 \
  /srv/cognelo/instance1/deployments \
  /srv/cognelo/instance1/shared \
  /srv/cognelo/instance1/shared/storage
```

The service account must not be shared by other Cognelo instances.

## 7. Create the production environment file

Create the file with restrictive permissions:

```bash
sudo install -m 0640 -o cognelo-instance1 -g cognelo-instance1 \
  /dev/null /srv/cognelo/instance1/shared/.env
sudo nano /srv/cognelo/instance1/shared/.env
```

Generate a JWT secret separately:

```bash
openssl rand -hex 48
```

Use this environment template. Replace every placeholder and keep the public URLs free of trailing slashes:

```dotenv
NODE_ENV=production
DATABASE_URL="postgresql://cognelo_instance1:DATABASE_PASSWORD@127.0.0.1:5432/cognelo_instance1?schema=public&connection_limit=10&pool_timeout=10"
JWT_SECRET="PASTE_96_CHARACTER_HEX_SECRET"
NEXT_PUBLIC_API_URL="https://instance1.cognelo.org"
CORS_ORIGIN="https://instance1.cognelo.org"

COGNELO_BACKGROUND_JOBS_DISABLED=false
COGNELO_BACKGROUND_JOBS_CONCURRENCY=1
COGNELO_BACKGROUND_JOBS_INTERVAL_MS=1000
COGNELO_BACKGROUND_JOBS_WORKER_ID="instance1-api-worker"

JUDGE0_BASE_URL="http://127.0.0.1:2358"
JUDGE0_AUTH_HEADER="X-Auth-Token"
JUDGE0_AUTH_TOKEN="REPLACE_IF_CODING_EXERCISES_ARE_ENABLED"
JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true

WEB_DESIGN_RUNNER_URL="http://127.0.0.1:3456"
```

If a sandbox service is on another host, use its private HTTPS or private-network URL. Leave the corresponding activity plugin disabled until that dependency is secured and reachable.

Check permissions:

```bash
sudo chown cognelo-instance1:cognelo-instance1 /srv/cognelo/instance1/shared/.env
sudo chmod 0640 /srv/cognelo/instance1/shared/.env
```

## 8. Deploy a Git tag

Use a deployment key with read-only repository access if the repository is private. Clone the complete repository once for the instance; do not use `--depth 1`. The local history and tags are useful for verifying deployments, comparing versions, and preparing a rollback without depending on a fresh clone.

```bash
sudo -u cognelo-instance1 git clone \
  REPOSITORY_URL \
  /srv/cognelo/instance1/repository

sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  fetch --prune --tags
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  rev-parse --verify 'refs/tags/v0.1.0^{commit}'
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  worktree add --detach \
  /srv/cognelo/instance1/deployments/v0.1.0 \
  refs/tags/v0.1.0

sudo -u cognelo-instance1 ln -s ../../shared/.env \
  /srv/cognelo/instance1/deployments/v0.1.0/.env
sudo -u cognelo-instance1 ln -s ../../shared/storage \
  /srv/cognelo/instance1/deployments/v0.1.0/storage
```

`v0.1.0` represents the immutable tag selected for deployment. Annotated, signed tags are recommended and can be verified with `git verify-tag v0.1.0` when signing is configured. Production tags must not be moved or reused; every deployment candidate receives a new tag.

The `deployments/` directories are filesystem deployment slots, not GitHub Releases. Each one is a detached Git worktree at an exact tag. The storage symlink is mandatory: uploaded course files and homework artifacts currently live below the repository-level `storage/` path, and without the symlink they would be lost when an old deployment is removed.

Install dependencies, generate Prisma clients, verify, and build as the service account:

```bash
sudo -u cognelo-instance1 /bin/bash -c '
  cd /srv/cognelo/instance1/deployments/v0.1.0 &&
  set -a && . ./.env && set +a &&
  npm ci &&
  npm run db:generate &&
  npm run typecheck &&
  npm test &&
  npm run build
'
```

Builds may report the known Turbopack file-tracing warning caused by plugin Prisma clients. A successful build still ends with both the API and web route summaries.

Apply all core and plugin migrations from the new deployment:

```bash
sudo -u cognelo-instance1 /bin/bash -c '
  cd /srv/cognelo/instance1/deployments/v0.1.0 &&
  npm run db:migrate:all
'
```

Do not run `npm run db:seed` in production. It creates demonstration users, courses, and content.

Point `current` at the tagged deployment:

```bash
sudo ln -sfn /srv/cognelo/instance1/deployments/v0.1.0 /srv/cognelo/instance1/current
sudo chown -h cognelo-instance1:cognelo-instance1 /srv/cognelo/instance1/current
```

## 9. Create the first administrator

Cognelo includes a production bootstrap command that creates the standard roles, registers discovered plugins, creates core activity types, and creates the first administrator. It does not add demo data.

Read the password without storing it in shell history:

```bash
read -rsp "Initial administrator password: " COGNELO_INITIAL_ADMIN_PASSWORD
echo

cd /srv/cognelo/instance1/current
sudo -u cognelo-instance1 env \
  COGNELO_ADMIN_EMAIL="admin@example.org" \
  COGNELO_ADMIN_FIRST_NAME="Ada" \
  COGNELO_ADMIN_LAST_NAME="Admin" \
  COGNELO_ADMIN_PASSWORD="$COGNELO_INITIAL_ADMIN_PASSWORD" \
  npm run production:bootstrap

unset COGNELO_INITIAL_ADMIN_PASSWORD
```

The bootstrap password must contain at least 12 characters. If the email already exists, the command adds the admin role but deliberately does not reset that account's password.

## 10. Create systemd services

Create `/etc/systemd/system/cognelo-instance1-api.service`:

```ini
[Unit]
Description=Cognelo instance1 API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=cognelo-instance1
Group=cognelo-instance1
WorkingDirectory=/srv/cognelo/instance1/current/apps/api
EnvironmentFile=/srv/cognelo/instance1/shared/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /srv/cognelo/instance1/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3101
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/cognelo-instance1-web.service`:

```ini
[Unit]
Description=Cognelo instance1 web
After=network-online.target cognelo-instance1-api.service
Wants=network-online.target

[Service]
Type=simple
User=cognelo-instance1
Group=cognelo-instance1
WorkingDirectory=/srv/cognelo/instance1/current/apps/web
EnvironmentFile=/srv/cognelo/instance1/shared/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /srv/cognelo/instance1/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3100
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Load and start them:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cognelo-instance1-api cognelo-instance1-web
sudo systemctl status cognelo-instance1-api --no-pager
sudo systemctl status cognelo-instance1-web --no-pager
```

Verify the private listeners and health endpoint:

```bash
sudo ss -ltnp | grep -E ':(3100|3101)\b'
curl --fail http://127.0.0.1:3101/api/health
curl --head http://127.0.0.1:3100/
```

The health endpoint returns `{"ok":true}` only when the API can query PostgreSQL.

## 11. Configure Apache

Create `/etc/apache2/sites-available/instance1.cognelo.org.conf`:

```apache
<VirtualHost *:80>
    ServerName instance1.cognelo.org

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyTimeout 300

    # The API mapping must appear before the catch-all web mapping.
    ProxyPass        /api/ http://127.0.0.1:3101/api/ retry=0 timeout=300
    ProxyPassReverse /api/ http://127.0.0.1:3101/api/

    ProxyPass        / http://127.0.0.1:3100/ retry=0 timeout=120
    ProxyPassReverse / http://127.0.0.1:3100/

    # Cognelo accepts files up to 25 MiB. Leave room for multipart overhead.
    LimitRequestBody 33554432

    ErrorLog ${APACHE_LOG_DIR}/instance1-cognelo-error.log
    CustomLog ${APACHE_LOG_DIR}/instance1-cognelo-access.log combined
</VirtualHost>
```

Apache's `ProxyPass` and `ProxyPassReverse` behavior is documented in the [Apache reverse proxy guide](https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html). `ProxyRequests Off` is important: Cognelo needs a reverse proxy, never an open forward proxy.

Enable and test the site:

```bash
sudo a2ensite instance1.cognelo.org.conf
sudo apachectl configtest
sudo systemctl reload apache2
curl --head http://instance1.cognelo.org/
curl --fail http://instance1.cognelo.org/api/health
```

## 12. Enable HTTPS

Install Certbot using its current Ubuntu/Apache instructions. The Certbot project currently recommends its snap distribution:

```bash
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --apache -d instance1.cognelo.org
sudo certbot renew --dry-run
```

See the maintained [Certbot Apache instructions](https://certbot.eff.org/instructions?ws=apache&os=snap). Select the redirect-to-HTTPS option when prompted.

After Certbot creates the SSL virtual host, add this header inside its `:443` virtual host if Certbot did not add it:

```apache
Header always set Strict-Transport-Security "max-age=31536000"
```

Do not add `includeSubDomains` until every subdomain of `cognelo.org` is HTTPS-ready.

Recheck:

```bash
sudo apachectl configtest
sudo systemctl reload apache2
curl --fail https://instance1.cognelo.org/api/health
```

## 13. First login and plugin activation

1. Open `https://instance1.cognelo.org/login`.
2. Sign in with the bootstrap administrator.
3. Open **Settings → Plugins**.
4. Activate and enable only the plugins needed by this instance.
5. Keep coding-exercise plugins disabled until their sandbox dependency is secured.
6. If the bootstrap credential was communicated to another operator, rotate it with the password-change form under **Settings → Profile**.

## 14. Optional sandbox services

### Judge0

Judge0 executes arbitrary learner programs and its standard stack uses privileged containers. The recommended production design is a dedicated sandbox server or VM on a private network, not the Cognelo/PostgreSQL host. Permit Judge0 traffic only from the Cognelo API host, configure a strong authentication token, and set the instance's `JUDGE0_*` values to that private endpoint.

If no secured Judge0 service exists, leave the regular coding-exercise plugin disabled. MCQ and Parsons do not require Judge0.

### Web-design runner

The web-design runner launches Chromium against learner-authored HTML, CSS, and JavaScript. Run it in the official Playwright container on a dedicated sandbox host or at least an isolated internal Docker network with:

- no database URL, JWT secret, API key, or mounted Cognelo storage;
- no public port;
- CPU, memory, PID, and execution-time limits;
- restricted outbound network access to prevent server-side request forgery;
- a Playwright image matching the version in `packages/web-design-runner/package.json`;
- the private `WEB_DESIGN_RUNNER_URL` reachable only by the Cognelo API.

The repository's current `docker-compose.yml` is a development configuration: it bind-mounts source and runs `npm install` at container startup. Do not deploy that Compose service unchanged in production. Until a hardened runner is provisioned, leave the web-design coding plugin disabled.

## 15. Add another Cognelo instance

Repeat Sections 3–13 with a new inventory row. In particular:

1. Add the new DNS record.
2. Create a new Unix service account and `/srv/cognelo/INSTANCE` tree.
3. Create a new PostgreSQL role and database.
4. Generate a new database password and JWT secret.
5. choose unused localhost web/API ports;
6. build the tagged deployment with that instance's own `NEXT_PUBLIC_API_URL`;
7. create separate systemd service files;
8. create a separate Apache virtual host and certificate;
9. create a separate administrator;
10. verify that the storage symlink points to that instance's own shared storage.

Useful collision checks:

```bash
sudo ss -ltnp
sudo -u postgres psql -c '\l'
sudo -u postgres psql -c '\du'
systemctl list-units 'cognelo-*'
sudo apachectl -S
```

Multiple instances may share the host PostgreSQL service and Apache process, but they do not share databases, files, sessions, service accounts, or Node processes.

## 16. Backups

Back up both PostgreSQL and `shared/storage`. A database-only backup is incomplete because uploaded bytes live on disk.

Example manual backup:

```bash
sudo install -d -m 0700 /var/backups/cognelo/instance1

sudo -u postgres pg_dump \
  --format=custom \
  --file=/var/backups/cognelo/instance1/database-$(date +%F-%H%M%S).dump \
  cognelo_instance1

sudo tar -C /srv/cognelo/instance1/shared \
  -czf /var/backups/cognelo/instance1/storage-$(date +%F-%H%M%S).tar.gz \
  storage
```

Copy backups to encrypted off-host storage, define retention, and test restores regularly. For a strict point-in-time pair, briefly stop the API while taking both backups:

```bash
sudo systemctl stop cognelo-instance1-api
# Run pg_dump and the storage archive.
sudo systemctl start cognelo-instance1-api
```

Basic restore sequence:

1. Stop the instance's web and API services.
2. Preserve the failed database and storage directory rather than overwriting them.
3. Re-create an empty instance database owned by its instance role.
4. Restore with `pg_restore --clean --if-exists --no-owner`.
5. Restore the storage archive to `shared/storage` and repair ownership.
6. Run `npm run db:migrate:all` from the active deployment.
7. Start the API, check `/api/health`, then start the web process.

## 17. Deploy an update

Never build over the active deployment and never deploy a mutable branch head such as `main` directly.

1. Create and push a new immutable Git tag for the version being deployed.
2. Fetch and resolve that tag in the instance repository.
3. Create a detached worktree in `deployments/<tag>`.
4. Link its `.env` and `storage` to `shared`.
5. Run `npm ci`, Prisma generation, typecheck, tests, and build.
6. Back up the database and storage.
7. Stop the API for the migration window.
8. Run `npm run db:migrate:all` from the new tagged deployment.
9. Atomically move `current` to the new deployment.
10. Restart API and web.
11. Verify local health, public health, login, file download, and one representative activity.
12. Retain at least one previous tagged deployment until the deployment is accepted.

Example update to tag `v0.2.0`:

```bash
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  fetch --prune --tags
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  rev-parse --verify 'refs/tags/v0.2.0^{commit}'
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  worktree add --detach \
  /srv/cognelo/instance1/deployments/v0.2.0 \
  refs/tags/v0.2.0

sudo -u cognelo-instance1 ln -s ../../shared/.env \
  /srv/cognelo/instance1/deployments/v0.2.0/.env
sudo -u cognelo-instance1 ln -s ../../shared/storage \
  /srv/cognelo/instance1/deployments/v0.2.0/storage

sudo -u cognelo-instance1 /bin/bash -c '
  cd /srv/cognelo/instance1/deployments/v0.2.0 &&
  set -a && . ./.env && set +a &&
  npm ci &&
  npm run db:generate &&
  npm run typecheck &&
  npm test &&
  npm run build
'

sudo systemctl stop cognelo-instance1-api
sudo -u cognelo-instance1 /bin/bash -c '
  cd /srv/cognelo/instance1/deployments/v0.2.0 && npm run db:migrate:all
'
sudo ln -sfn /srv/cognelo/instance1/deployments/v0.2.0 /srv/cognelo/instance1/current
sudo chown -h cognelo-instance1:cognelo-instance1 /srv/cognelo/instance1/current
sudo systemctl restart cognelo-instance1-api cognelo-instance1-web
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://instance1.cognelo.org/api/health
```

Code rollback is a symlink switch to a previous tag only when the new database migrations are backward-compatible. Otherwise restore the pre-deployment database and storage backups before starting the previous tagged deployment.

After a deployment is accepted and no longer needed for rollback, remove its worktree through Git rather than deleting it by hand:

```bash
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  worktree remove /srv/cognelo/instance1/deployments/v0.1.0
sudo -u cognelo-instance1 git -C /srv/cognelo/instance1/repository \
  worktree prune
```

## 18. Logs and troubleshooting

```bash
# Node services
sudo journalctl -u cognelo-instance1-api -n 200 --no-pager
sudo journalctl -u cognelo-instance1-web -n 200 --no-pager
sudo journalctl -u cognelo-instance1-api -f

# Apache
sudo tail -f /var/log/apache2/instance1-cognelo-error.log
sudo tail -f /var/log/apache2/instance1-cognelo-access.log

# PostgreSQL
sudo journalctl -u postgresql -n 200 --no-pager

# Configuration and listeners
sudo apachectl configtest
sudo apachectl -S
sudo ss -ltnp

# Service and application health
systemctl is-active cognelo-instance1-api cognelo-instance1-web apache2 postgresql
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://instance1.cognelo.org/api/health
```

Common failure causes:

- `502 Proxy Error`: the mapped Node process is stopped or the Apache port does not match systemd.
- API health returns `500`: inspect the API journal and verify `DATABASE_URL`, database ownership, and migrations.
- Login succeeds locally but not publicly: verify `NODE_ENV=production`, HTTPS, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, and that the web build used the production `.env`.
- Upload succeeds but files disappear after deployment: the deployment's `storage` symlink is missing or points to the wrong instance.
- A plugin is absent from the picker: activate and enable it in administrator settings; also verify its external dependency when applicable.
- Browser calls the wrong hostname: rebuild the web application after correcting `NEXT_PUBLIC_API_URL`; changing it only at runtime is insufficient.

## 19. Production security checklist

- Use SSH keys and restrict SSH source addresses where practical.
- Keep Ubuntu, Node.js, Apache, PostgreSQL, and sandbox images patched.
- Expose only ports 22, 80, and 443; restrict port 22 further if possible.
- Keep PostgreSQL and Node listeners on loopback.
- Use a unique JWT secret and database credentials per instance.
- Protect `.env`, backups, and deploy keys; never commit them.
- Do not run production services as root.
- Do not use the development seed in production.
- Do not deploy the development runner Compose configuration as production.
- Keep untrusted code execution off the database/application host when possible.
- Configure off-host backups and verify restoration.
- Review Apache and authentication logs. Cognelo does not yet provide centralized login rate limiting, so add edge/WAF controls before exposing a high-risk public instance.
- Test certificate renewal with `certbot renew --dry-run` after every TLS configuration change.

## 20. Deployment acceptance checklist

- [ ] DNS resolves only to intended addresses.
- [ ] UFW exposes only approved public ports.
- [ ] PostgreSQL, web, API, and optional runners are not publicly reachable.
- [ ] Core and plugin migrations complete without errors.
- [ ] `/api/health` succeeds locally and through HTTPS.
- [ ] The administrator can sign in and change their password.
- [ ] Required plugins are activated and enabled; unused plugins remain disabled.
- [ ] An uploaded file survives a service restart and deployment switch.
- [ ] A representative student submission reaches the gradebook.
- [ ] Optional coding sandboxes work only through their private endpoints.
- [ ] Database and storage backups complete and exist off-host.
- [ ] Logs contain no secrets or recurring startup errors.
