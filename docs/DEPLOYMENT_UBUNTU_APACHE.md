# Deploying Cognelo on Ubuntu with Apache

This guide deploys one or more production Cognelo instances on a bare Ubuntu server. It uses:

- Apache as the public TLS reverse proxy;
- PostgreSQL installed directly on the host;
- two systemd-managed Node.js processes per Cognelo instance;
- one database, Unix account, storage directory, environment file, and port pair per instance;
- Docker only for the Judge0 and Playwright code-execution sandboxes, preferably on a separate server or VM.

The examples use `instance1.cognelo.org` and the instance key `instance1`. Every example hostname, account, database, path, and port is a placeholder and must be replaced with values assigned to the target installation.

## 1. Recommended topology

```text
Application host
Internet
   |
   v
Apache :80/:443
   |-- /api/*  --> 127.0.0.1:3101  Cognelo API (systemd)
   `-- /*      --> 127.0.0.1:3100  Cognelo web (systemd)

Cognelo API
   |-- 127.0.0.1:5432/cognelo_instance1  host PostgreSQL
   |-- /srv/cognelo/instance1/shared/storage
   |-- 127.0.0.1:2358 --\
   `-- 127.0.0.1:3456 ---+-- systemd SSH tunnel --> Sandbox host
                                                   |-- Judge0 containers
                                                   `-- Playwright runner container
```

Apache is the reference reverse proxy for this runbook. It provides the required HTTP reverse proxying, path-based routing, TLS termination, and upload handling. Nginx and Caddy can satisfy the same application requirements, but their configuration is outside the scope of this document. Next.js recommends placing a reverse proxy in front of a self-hosted Node server, and its Node deployment retains all framework features: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [Next.js deployment modes](https://nextjs.org/docs/app/getting-started/deploying).

PostgreSQL should run on the application host for this topology. Docker remains appropriate for untrusted-code sandboxes because their dependency and isolation requirements are materially different from the web application. The reference deployment binds both sandbox APIs to loopback on the sandbox host and carries them through a restricted SSH tunnel; neither API receives a public or private-network listener.

Sections 3–13 produce a working Cognelo instance without code execution. Section 14 completes the deployment with Judge0 and the Playwright runner. Keep the dependent plugins disabled until Section 14's smoke tests pass.

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
| Local Judge0 tunnel port | `2358` | `2359` |
| Local Playwright tunnel port | `3456` | `3457` |
| Sandbox Compose project | `cognelo-instance1-sandbox` | `cognelo-instance2-sandbox` |

Every instance needs a different web/API port pair, sandbox tunnel port pair, database, database role, JWT secret, environment file, and storage directory. Do not reuse a web build between hostnames: `NEXT_PUBLIC_API_URL` is embedded when the web application is built.

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

These loopback URLs are correct for the SSH-tunnel deployment in Section 14. For a second co-located instance, use its allocated tunnel ports instead. Leave the corresponding activity plugin disabled until that dependency is secured and reachable.

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

## 14. Deploy Judge0 and the Playwright runner

This section is required when the corresponding plugins are enabled:

| Dependency | Cognelo feature | Required application setting |
|---|---|---|
| Judge0 | Coding exercises | `JUDGE0_BASE_URL`, header, and token |
| Cognelo Playwright runner | Web-design coding exercises and screenshots | `WEB_DESIGN_RUNNER_URL` |

MCQ, Parsons problems, tests composed only of those activities, and ordinary course materials do not use either service.

Judge0 executes learner programs in privileged containers. The Playwright runner executes teacher-authored test code against learner-authored HTML, CSS, and JavaScript in Chromium. Treat the whole sandbox machine as disposable and untrusted: give it no Cognelo database credentials, JWT secret, deploy key for the application host, mounted application storage, or access to PostgreSQL. The reference setup uses a dedicated Ubuntu VM and a separate Compose project for each Cognelo instance.

The `judge0-db` PostgreSQL container is Judge0's own private implementation dependency, not Cognelo's application database. Keeping Cognelo PostgreSQL on the application host and Judge0's official DB/Redis pair inside the disposable sandbox stack avoids exposing either database across hosts.

The checked-in production files are:

- `infra/production/sandbox.compose.yml` — Judge0, its private PostgreSQL/Redis dependencies, and the web-design runner;
- `infra/production/judge0.conf.example` — restricted Judge0 defaults matching Cognelo's requests;
- `infra/production/web-design-runner.Dockerfile` — a non-root runner image using the repository's exact Playwright version.

The root `docker-compose.yml` remains development-only and must not be used here.

### 14.1 Prepare the sandbox host

The commands below run on the dedicated sandbox host. Judge0 CE `1.13.1` officially recommends **Ubuntu Server 22.04** and a legacy cgroup hierarchy; do not substitute Ubuntu 24.04 for this VM without first validating real submissions against a supported newer Judge0 release. The application host may use a newer supported Ubuntu LTS. The requirement and exact kernel flag are in the [Judge0 1.13.1 deployment notes](https://github.com/judge0/judge0/releases/tag/v1.13.1#deployment-procedure).

A practical starting size for a small installation is 4 vCPU, 8 GB RAM, 40 GB SSD, and no swap-backed overcommit for execution workloads. The supplied configuration starts two Judge0 workers and limits the Playwright runner to 2 vCPU/2 GB. Monitor queue latency, memory, and disk before raising `COUNT` or running more instances.

Install only the tools needed there:

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git openssl ufw
```

Preserve any existing kernel arguments and add `systemd.unified_cgroup_hierarchy=0` inside `GRUB_CMDLINE_LINUX` in `/etc/default/grub`:

```text
GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"
```

If `GRUB_CMDLINE_LINUX` already contains values, append the new value inside the same quotes rather than replacing them. Apply the change and reboot the dedicated VM:

```bash
sudo nano /etc/default/grub
sudo update-grub
sudo reboot
```

After reconnecting, confirm the host is 22.04 and that cgroup v1 controllers are mounted. Do not continue if only a single `cgroup2` mount is present:

```bash
. /etc/os-release
echo "$PRETTY_NAME"
mount | grep -E 'type cgroup( |2 )'
```

Install Docker Engine and the Compose plugin from Docker's Ubuntu repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

This follows Docker's maintained [Ubuntu installation procedure](https://docs.docker.com/engine/install/ubuntu/). Configure UFW so the sandbox host exposes SSH only; the container APIs will bind to loopback:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status verbose
```

Create a system account and directories for the first instance:

```bash
sudo useradd --system --create-home \
  --home-dir /srv/cognelo-sandboxes/instance1 \
  --shell /usr/sbin/nologin \
  cognelo-sandbox-instance1

sudo install -d -m 0750 \
  -o cognelo-sandbox-instance1 -g cognelo-sandbox-instance1 \
  /srv/cognelo-sandboxes/instance1/repository \
  /srv/cognelo-sandboxes/instance1/deployments \
  /srv/cognelo-sandboxes/instance1/runtime
```

### 14.2 Check out the same application tag

The runner source and its Playwright dependency belong to the Cognelo tag being deployed. Clone the complete repository and check out that same immutable tag; the example continues to use `v0.1.0`:

```bash
sudo -u cognelo-sandbox-instance1 git clone \
  REPOSITORY_URL \
  /srv/cognelo-sandboxes/instance1/repository/source

sudo -u cognelo-sandbox-instance1 git \
  -C /srv/cognelo-sandboxes/instance1/repository/source \
  fetch --prune --tags
sudo -u cognelo-sandbox-instance1 git \
  -C /srv/cognelo-sandboxes/instance1/repository/source \
  rev-parse --verify 'refs/tags/v0.1.0^{commit}'
sudo -u cognelo-sandbox-instance1 git \
  -C /srv/cognelo-sandboxes/instance1/repository/source \
  worktree add --detach \
  /srv/cognelo-sandboxes/instance1/deployments/v0.1.0 \
  refs/tags/v0.1.0
```

Copy the versioned runtime templates into the instance's persistent runtime directory:

```bash
sudo install -m 0644 \
  /srv/cognelo-sandboxes/instance1/deployments/v0.1.0/infra/production/sandbox.compose.yml \
  /srv/cognelo-sandboxes/instance1/runtime/sandbox.compose.yml

sudo install -m 0600 \
  /srv/cognelo-sandboxes/instance1/deployments/v0.1.0/infra/production/judge0.conf.example \
  /srv/cognelo-sandboxes/instance1/runtime/judge0.conf
```

### 14.3 Configure Judge0 secrets and limits

Generate four independent values. Copy each output directly to its matching `REPLACE_*` entry in `runtime/judge0.conf`:

```bash
openssl rand -hex 32  # AUTHN_TOKEN; also copied to Cognelo's JUDGE0_AUTH_TOKEN
openssl rand -hex 32  # REDIS_PASSWORD
openssl rand -hex 32  # POSTGRES_PASSWORD
openssl rand -hex 64  # SECRET_KEY_BASE

sudo nano /srv/cognelo-sandboxes/instance1/runtime/judge0.conf
sudo grep -n 'REPLACE_' /srv/cognelo-sandboxes/instance1/runtime/judge0.conf
```

The final `grep` must print nothing. Preserve the Judge0 authentication token in the application host's `/srv/cognelo/instance1/shared/.env`:

```dotenv
JUDGE0_BASE_URL="http://127.0.0.1:2358"
JUDGE0_AUTH_HEADER="X-Auth-Token"
JUDGE0_AUTH_TOKEN="PASTE_THE_SAME_AUTHN_TOKEN"
JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true
```

The supplied Judge0 configuration enables the synchronous `wait=true` submissions Cognelo uses, permits Cognelo's per-process/thread limit flags, caps CPU at 5 seconds, wall time at 10 seconds, and memory at 128 MB, and disables submission networking, callbacks, command-line arguments, compiler options, batch requests, and additional files. Review these limits when Cognelo's execution contract changes. Judge0's complete option reference is its [versioned configuration file](https://github.com/judge0/judge0/blob/v1.13.1/judge0.conf).

### 14.4 Build the pinned Playwright runner

The repository currently depends on `@playwright/test` `1.59.1`, so the production Dockerfile deliberately uses `mcr.microsoft.com/playwright:v1.59.1-noble`. Playwright requires the image and package versions to match; update both in source and test them together rather than changing only the container tag. See [Playwright's Docker version guidance](https://playwright.dev/docs/docker#image-tags).

Build a local immutable image from the selected Cognelo tag:

```bash
cd /srv/cognelo-sandboxes/instance1/deployments/v0.1.0
sudo docker build \
  --file infra/production/web-design-runner.Dockerfile \
  --tag cognelo/web-design-runner:v0.1.0 \
  .
sudo docker image inspect cognelo/web-design-runner:v0.1.0 \
  --format '{{.Id}}'
```

Download the seccomp profile from the same Playwright release and record its checksum:

```bash
sudo curl -fsSLo /srv/cognelo-sandboxes/instance1/runtime/seccomp_profile.json \
  https://raw.githubusercontent.com/microsoft/playwright/v1.59.1/utils/docker/seccomp_profile.json
sudo chmod 0644 /srv/cognelo-sandboxes/instance1/runtime/seccomp_profile.json
sha256sum /srv/cognelo-sandboxes/instance1/runtime/seccomp_profile.json
```

Microsoft's image includes browser binaries and system dependencies but not the Node package. The Cognelo image adds the locked runner package, switches to `pwuser`, and starts only the runner. The Compose service adds the Chromium seccomp profile, drops Linux capabilities, makes the root filesystem read-only, gives Chromium bounded temporary storage, and applies CPU, memory, and PID limits. The official image alone is not a complete security boundary for untrusted content; the dedicated host and blocked outbound network are also required. See [Playwright's Docker security notes](https://playwright.dev/docs/docker#run-the-image).

### 14.5 Configure and start the sandbox stack

Create `/srv/cognelo-sandboxes/instance1/runtime/.env`:

```dotenv
COMPOSE_PROJECT_NAME=cognelo-instance1-sandbox
SANDBOX_BIND_ADDRESS=127.0.0.1
JUDGE0_PORT=2358
WEB_DESIGN_RUNNER_PORT=3456
JUDGE0_IMAGE=judge0/judge0:1.13.1
WEB_DESIGN_RUNNER_IMAGE=cognelo/web-design-runner:v0.1.0
PLAYWRIGHT_SECCOMP_PROFILE=/srv/cognelo-sandboxes/instance1/runtime/seccomp_profile.json
```

Set restrictive permissions, validate the resolved Compose model, and pull the pinned upstream images:

```bash
sudo chmod 0600 /srv/cognelo-sandboxes/instance1/runtime/.env
cd /srv/cognelo-sandboxes/instance1/runtime

sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml \
  pull judge0-server judge0-workers judge0-db judge0-redis
```

`judge0/judge0:1.13.1`, `postgres:16.2`, `redis:7.2.4`, and the Playwright base image are pinned rather than `latest`. For even stricter supply-chain control, replace each tag with the image digest printed by `docker image inspect --format '{{index .RepoDigests 0}}' IMAGE` after the first approved pull.

Start Judge0's data services first, inspect them, and then start the complete stack:

```bash
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d judge0-db judge0-redis
sudo docker compose --env-file .env -f sandbox.compose.yml ps
sudo docker compose --env-file .env -f sandbox.compose.yml \
  logs --tail=100 judge0-db judge0-redis

sudo docker compose --env-file .env -f sandbox.compose.yml up -d
sudo docker compose --env-file .env -f sandbox.compose.yml ps
sudo docker compose --env-file .env -f sandbox.compose.yml logs --tail=200
sudo ss -ltnp | grep -E '127\.0\.0\.1:(2358|3456)\b'
```

Both published ports must show `127.0.0.1`, never `0.0.0.0`, `[::]`, a private LAN address, or a public address. The Compose network is marked `internal`, so neither learner code nor Chromium can make outbound requests. Consequently, web-design exercises must include the required HTML, CSS, and JavaScript instead of loading CDN assets.

Check the runner locally on the sandbox host:

```bash
curl --fail http://127.0.0.1:3456/health
```

Judge0 requires its token even on loopback. Read it without adding it to shell history, then verify the language list:

```bash
read -rsp "Judge0 AUTHN_TOKEN: " JUDGE0_SMOKE_TOKEN
echo
curl --fail \
  --header "X-Auth-Token: ${JUDGE0_SMOKE_TOKEN}" \
  http://127.0.0.1:2358/languages
unset JUDGE0_SMOKE_TOKEN
```

### 14.6 Create the restricted SSH tunnel

The sandbox APIs have no network listener, so the application host reaches them through a persistent local-forwarding SSH connection.

On the **application host**, generate a dedicated key as the instance service account:

```bash
sudo -u cognelo-instance1 ssh-keygen \
  -t ed25519 -N '' \
  -f /srv/cognelo/instance1/shared/sandbox_tunnel_ed25519
sudo cat /srv/cognelo/instance1/shared/sandbox_tunnel_ed25519.pub
```

On the **sandbox host**, create a tunnel-only account and its authorized-keys file:

```bash
sudo useradd --system --create-home \
  --home-dir /srv/cognelo-tunnels/instance1 \
  --shell /usr/sbin/nologin \
  cognelo-tunnel-instance1
sudo install -d -m 0700 \
  -o cognelo-tunnel-instance1 -g cognelo-tunnel-instance1 \
  /srv/cognelo-tunnels/instance1/.ssh
sudo install -m 0600 \
  -o cognelo-tunnel-instance1 -g cognelo-tunnel-instance1 \
  /dev/null /srv/cognelo-tunnels/instance1/.ssh/authorized_keys
sudo nano /srv/cognelo-tunnels/instance1/.ssh/authorized_keys
```

Insert the public key on one line, preceded by restrictions exactly like this:

```text
restrict,port-forwarding,permitopen="127.0.0.1:2358",permitopen="127.0.0.1:3456" ssh-ed25519 PASTE_PUBLIC_KEY cognelo-instance1
```

This key cannot allocate a terminal, use agent/X11 forwarding, or forward arbitrary destinations. Confirm that `/etc/ssh/sshd_config` does not globally disable TCP forwarding, then reload SSH after any change:

```bash
sudo sshd -t
sudo systemctl reload ssh
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Record the displayed sandbox-host fingerprint through the server console or another trusted channel. On the **application host**, collect the host key and verify that its fingerprint matches before continuing:

```bash
sudo -u cognelo-instance1 ssh-keyscan -H SANDBOX_PRIVATE_IP_OR_NAME \
  | sudo tee /srv/cognelo/instance1/shared/sandbox_known_hosts >/dev/null
sudo chown cognelo-instance1:cognelo-instance1 \
  /srv/cognelo/instance1/shared/sandbox_known_hosts
sudo chmod 0644 /srv/cognelo/instance1/shared/sandbox_known_hosts
sudo ssh-keygen -lf /srv/cognelo/instance1/shared/sandbox_known_hosts
```

Create `/etc/systemd/system/cognelo-instance1-sandbox-tunnel.service` on the application host:

```ini
[Unit]
Description=Cognelo instance1 sandbox SSH tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=cognelo-instance1
Group=cognelo-instance1
ExecStart=/usr/bin/ssh -NT \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile=/srv/cognelo/instance1/shared/sandbox_known_hosts \
  -i /srv/cognelo/instance1/shared/sandbox_tunnel_ed25519 \
  -L 127.0.0.1:2358:127.0.0.1:2358 \
  -L 127.0.0.1:3456:127.0.0.1:3456 \
  cognelo-tunnel-instance1@SANDBOX_PRIVATE_IP_OR_NAME
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Make the API start after the tunnel by creating `/etc/systemd/system/cognelo-instance1-api.service.d/sandbox.conf`:

```ini
[Unit]
After=cognelo-instance1-sandbox-tunnel.service
Wants=cognelo-instance1-sandbox-tunnel.service
```

Enable the tunnel and verify the local forwards:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cognelo-instance1-sandbox-tunnel
sudo systemctl restart cognelo-instance1-api
sudo systemctl status cognelo-instance1-sandbox-tunnel --no-pager
sudo ss -ltnp | grep -E '127\.0\.0\.1:(2358|3456)\b'
curl --fail http://127.0.0.1:3456/health
```

### 14.7 Run end-to-end sandbox smoke tests

On the application host, verify an actual Judge0 compilation/execution. This example discovers the installed Python 3 language ID instead of hard-coding one:

```bash
sudo apt install -y jq
read -rsp "Judge0 AUTHN_TOKEN: " JUDGE0_SMOKE_TOKEN
echo

PYTHON_LANGUAGE_ID=$(
  curl --fail --silent --show-error \
    --header "X-Auth-Token: ${JUDGE0_SMOKE_TOKEN}" \
    http://127.0.0.1:2358/languages \
  | jq -r '[.[] | select(.name | startswith("Python (3"))][0].id'
)
test -n "${PYTHON_LANGUAGE_ID}" && test "${PYTHON_LANGUAGE_ID}" != "null"

curl --fail --silent --show-error \
  --request POST \
  --header "Content-Type: application/json" \
  --header "X-Auth-Token: ${JUDGE0_SMOKE_TOKEN}" \
  --data "{\"language_id\":${PYTHON_LANGUAGE_ID},\"source_code\":\"print(2 + 3)\",\"expected_output\":\"5\"}" \
  'http://127.0.0.1:2358/submissions?base64_encoded=false&wait=true' \
  | jq

unset JUDGE0_SMOKE_TOKEN PYTHON_LANGUAGE_ID
```

The result must have status `Accepted` and stdout `5`. Next, create a Playwright request without putting difficult JSON quoting on the command line:

```bash
tee /tmp/cognelo-runner-smoke.json >/dev/null <<'JSON'
{
  "files": [
    {
      "path": "index.html",
      "language": "html",
      "starterCode": "<main><h1 id=\"title\">Hello</h1></main>"
    }
  ],
  "tests": [
    {
      "id": "heading",
      "name": "Heading is rendered",
      "testCode": "await expect(page.locator('#title')).toHaveText('Hello');",
      "weight": 1
    }
  ],
  "timeoutMs": 5000
}
JSON

curl --fail --silent --show-error \
  --header 'Content-Type: application/json' \
  --data-binary @/tmp/cognelo-runner-smoke.json \
  http://127.0.0.1:3456/run \
  | jq
rm /tmp/cognelo-runner-smoke.json
```

The runner result must report `status: "completed"`, `score: 1`, and `maxScore: 1`. Finally:

1. restart the sandbox host and application host separately;
2. confirm the Compose stack and SSH tunnel return automatically;
3. activate the required plugins under **Settings → Plugins**;
4. submit one small coding exercise and one web-design exercise through the Cognelo UI;
5. confirm both results reach the gradebook.

### 14.8 Same-host fallback

For a small installation with only one Ubuntu server, the same Compose project can run there with `SANDBOX_BIND_ADDRESS=127.0.0.1`; omit the SSH tunnel and retain the loopback URLs in Cognelo's `.env`. This is operationally simpler, but Judge0's server and worker containers are privileged. A container escape or kernel vulnerability would then place Cognelo, PostgreSQL, uploaded files, and every co-located instance in the same failure domain. The dedicated sandbox VM is therefore the production reference, not merely a performance optimization.

## 15. Add another Cognelo instance

Repeat Sections 3–14 with a new inventory row. In particular:

1. Add the new DNS record.
2. Create a new Unix service account and `/srv/cognelo/INSTANCE` tree.
3. Create a new PostgreSQL role and database.
4. Generate a new database password and JWT secret.
5. choose unused localhost web/API ports;
6. build the tagged deployment with that instance's own `NEXT_PUBLIC_API_URL`;
7. create separate systemd service files;
8. create a separate Apache virtual host and certificate;
9. create a separate administrator;
10. verify that the storage symlink points to that instance's own shared storage;
11. create a separate sandbox Compose project, Judge0 database volume, Judge0 token, and tunnel account;
12. assign unused Judge0 and runner ports at both ends of the tunnel.

For example, keep `instance1` on Judge0 `2358` and runner `3456`, then use `2359` and `3457` for `instance2`. Its sandbox `runtime/.env` contains:

```dotenv
COMPOSE_PROJECT_NAME=cognelo-instance2-sandbox
SANDBOX_BIND_ADDRESS=127.0.0.1
JUDGE0_PORT=2359
WEB_DESIGN_RUNNER_PORT=3457
JUDGE0_IMAGE=judge0/judge0:1.13.1
WEB_DESIGN_RUNNER_IMAGE=cognelo/web-design-runner:v0.1.0
PLAYWRIGHT_SECCOMP_PROFILE=/srv/cognelo-sandboxes/instance2/runtime/seccomp_profile.json
```

Its tunnel uses:

```text
-L 127.0.0.1:2359:127.0.0.1:2359
-L 127.0.0.1:3457:127.0.0.1:3457
```

and its application `.env` uses `http://127.0.0.1:2359` and `http://127.0.0.1:3457`. Do not share a Judge0 token or Compose project between instances. Separate projects avoid cross-instance database, queue, capacity, and lifecycle coupling. The same locally built runner image may be reused only when both instances run the exact same Cognelo tag.

Useful collision checks:

```bash
sudo ss -ltnp
sudo -u postgres psql -c '\l'
sudo -u postgres psql -c '\du'
systemctl list-units 'cognelo-*'
sudo apachectl -S
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Multiple instances may share the application host's PostgreSQL service and Apache process and may use the same dedicated sandbox VM, but they do not share databases, files, sessions, service accounts, Node processes, Compose projects, Judge0 state, or tunnel credentials.

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

The Playwright runner is stateless and is rebuilt from a Cognelo tag. Preserve the sandbox `runtime/.env`, `judge0.conf`, SSH authorized keys, image digests, and seccomp checksum in the protected configuration backup. Cognelo stores grading outcomes in its own database, so Judge0's submission database is not part of the authoritative Cognelo backup. If an organization nevertheless requires Judge0 submission retention, dump its container database separately:

```bash
cd /srv/cognelo-sandboxes/instance1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml \
  exec -T judge0-db pg_dump -U judge0 -Fc judge0 \
  > /var/backups/cognelo/instance1/judge0-$(date +%F-%H%M%S).dump
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

When the tag changes `packages/web-design-runner`, its dependencies, or `infra/production`, update the sandbox first:

1. fetch the new tag on the sandbox host and add a detached worktree as in Section 14.2;
2. build `cognelo/web-design-runner:<new-tag>` from that worktree;
3. review and copy any intentional Compose or Judge0 configuration changes into `runtime/` without overwriting secrets;
4. change only `WEB_DESIGN_RUNNER_IMAGE` in the sandbox `runtime/.env`;
5. run `docker compose config --quiet`, recreate the runner, and repeat both sandbox smoke tests;
6. deploy the application tag only after the matching runner passes.

Example runner update for `v0.2.0` on the sandbox host:

```bash
cd /srv/cognelo-sandboxes/instance1/deployments/v0.2.0
sudo docker build \
  --file infra/production/web-design-runner.Dockerfile \
  --tag cognelo/web-design-runner:v0.2.0 \
  .

sudo nano /srv/cognelo-sandboxes/instance1/runtime/.env
cd /srv/cognelo-sandboxes/instance1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d --no-deps web-design-runner
curl --fail http://127.0.0.1:3456/health
```

Judge0, PostgreSQL, Redis, and Playwright base-image upgrades are separate dependency upgrades, not routine restarts. Change a pinned version in a reviewed Cognelo tag, read its upstream migration notes, back up any retained Judge0 data, pull/build it, run the smoke tests, and then roll it into production. Never use an unattended `docker compose pull` against mutable tags.

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

# SSH tunnel on the application host
sudo journalctl -u cognelo-instance1-sandbox-tunnel -n 200 --no-pager
sudo systemctl status cognelo-instance1-sandbox-tunnel --no-pager

# Configuration and listeners
sudo apachectl configtest
sudo apachectl -S
sudo ss -ltnp

# Service and application health
systemctl is-active cognelo-instance1-api cognelo-instance1-web apache2 postgresql
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://instance1.cognelo.org/api/health
```

On the sandbox host:

```bash
cd /srv/cognelo-sandboxes/instance1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml ps
sudo docker compose --env-file .env -f sandbox.compose.yml logs --tail=200
sudo docker compose --env-file .env -f sandbox.compose.yml logs -f judge0-server judge0-workers
sudo docker compose --env-file .env -f sandbox.compose.yml logs -f web-design-runner
sudo docker stats
sudo ss -ltnp | grep -E '127\.0\.0\.1:(2358|3456)\b'
curl --fail http://127.0.0.1:3456/health
```

Common failure causes:

- `502 Proxy Error`: the mapped Node process is stopped or the Apache port does not match systemd.
- API health returns `500`: inspect the API journal and verify `DATABASE_URL`, database ownership, and migrations.
- Login succeeds locally but not publicly: verify `NODE_ENV=production`, HTTPS, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, and that the web build used the production `.env`.
- Upload succeeds but files disappear after deployment: the deployment's `storage` symlink is missing or points to the wrong instance.
- A plugin is absent from the picker: activate and enable it in administrator settings; also verify its external dependency when applicable.
- Browser calls the wrong hostname: rebuild the web application after correcting `NEXT_PUBLIC_API_URL`; changing it only at runtime is insufficient.
- `ECONNREFUSED` for Judge0 or the runner: check the tunnel unit on the application host, then `docker compose ps` and logs on the sandbox host.
- Judge0 returns `401 Unauthorized`: ensure `AUTHN_TOKEN` in `judge0.conf` exactly matches `JUDGE0_AUTH_TOKEN` in the instance `.env`, then restart the API after correcting it.
- Judge0 returns a limit validation error: compare the limits sent by the coding-exercise plugin with `MAX_*` and `ALLOW_ENABLE_*` in `judge0.conf`.
- Chromium fails to launch: verify the runner image version matches `@playwright/test`, the official seccomp profile is readable, and the container is running as `pwuser`; inspect runner logs before changing security options.
- A web-design exercise cannot load an external font, script, or image: expected in the hardened deployment; the runner has no outbound network. Include required assets in the exercise instead.

## 19. Production security checklist

- Use SSH keys and restrict SSH source addresses where practical.
- Keep Ubuntu, Node.js, Apache, PostgreSQL, and sandbox images patched.
- On the application host expose only 22, 80, and 443; on the sandbox host expose only 22. Restrict SSH source addresses where possible.
- Keep PostgreSQL and Node listeners on loopback.
- Use a unique JWT secret and database credentials per instance.
- Protect `.env`, backups, and deploy keys; never commit them.
- Do not run production services as root.
- Do not use the development seed in production.
- Do not deploy the development runner Compose configuration as production.
- Keep untrusted code execution off the database/application host when possible.
- Bind sandbox APIs to loopback, restrict the SSH key with `permitopen`, and verify the SSH host fingerprint.
- Keep each instance's sandbox Compose project, Judge0 token, ports, volume, and tunnel key separate.
- Run the Playwright runner as `pwuser` with the checked-in resource limits and the matching official seccomp profile.
- Keep the sandbox Compose network internal; do not grant learner executions outbound access without a separately reviewed proxy policy.
- Pin sandbox images and record approved image digests; do not deploy `latest`.
- Configure off-host backups and verify restoration.
- Review Apache and authentication logs. Cognelo does not yet provide centralized login rate limiting, so add edge/WAF controls before exposing a high-risk public instance.
- Test certificate renewal with `certbot renew --dry-run` after every TLS configuration change.

## 20. Deployment acceptance checklist

- [ ] DNS resolves only to intended addresses.
- [ ] UFW exposes only approved public ports.
- [ ] PostgreSQL, web, API, Judge0, and the Playwright runner are not publicly reachable.
- [ ] Core and plugin migrations complete without errors.
- [ ] `/api/health` succeeds locally and through HTTPS.
- [ ] The administrator can sign in and change their password.
- [ ] Required plugins are activated and enabled; unused plugins remain disabled.
- [ ] An uploaded file survives a service restart and deployment switch.
- [ ] A representative student submission reaches the gradebook.
- [ ] Sandbox containers bind only to sandbox-host loopback and have no outbound network.
- [ ] The restricted SSH tunnel restarts automatically and exposes only instance-specific application-host loopback ports.
- [ ] Judge0 authentication rejects a missing/incorrect token and accepts the configured token.
- [ ] The Judge0 Python execution smoke test returns `Accepted` and `5`.
- [ ] The Playwright runner smoke test reports `completed`, `1 / 1`.
- [ ] One real coding exercise and one real web-design exercise reach the gradebook.
- [ ] Database and storage backups complete and exist off-host.
- [ ] Logs contain no secrets or recurring startup errors.
