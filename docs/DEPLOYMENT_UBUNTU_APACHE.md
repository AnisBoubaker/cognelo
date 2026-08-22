# Deploying Cognelo on Ubuntu with Apache

This guide deploys a production Cognelo instance across two Ubuntu VPSs. It uses:

- Apache as the public TLS reverse proxy;
- PostgreSQL installed directly on the host;
- two systemd-managed Node.js processes per Cognelo instance;
- one database, Unix account, storage directory, environment file, and port pair per instance;
- a dedicated application VPS for Apache, Cognelo, PostgreSQL, and durable uploaded files;
- a dedicated sandbox VPS for Dockerized Judge0 and Playwright execution; and
- a WireGuard point-to-point network between the two VPSs.

The examples use `app1.cognelo.org` and the instance key `app1`. Every example hostname, address, account, database, path, and port is a placeholder and must be replaced with values assigned to the target installation.

## 1. Recommended topology

```text
Application VPS (recommended start: 4 vCPU, 8 GB RAM)
Internet
   |
   v
Apache :80/:443
   |-- /api/*  --> 127.0.0.1:3101  Cognelo API (systemd)
   `-- /*      --> 127.0.0.1:3100  Cognelo web (systemd)

Cognelo API
   |-- 127.0.0.1:5432/cognelo_app1  host PostgreSQL
   |-- /srv/cognelo/app1/shared/storage
   |-- 10.80.0.2:2358  --\
   `-- 10.80.0.2:3456  ---+-- WireGuard wg0 --> Sandbox VPS
                                             |-- Judge0 containers
                                             `-- Playwright runner container

WireGuard point-to-point network
   application wg0: 10.80.0.1/30
   sandbox wg0:     10.80.0.2/30

Sandbox VPS (recommended start: 4 vCPU, 8 GB RAM)
   public interface: SSH administration and WireGuard UDP only
   wg0: Judge0 :2358 and Playwright :3456, reachable only from 10.80.0.1
```

Apache is the reference reverse proxy for this runbook. It provides the required HTTP reverse proxying, path-based routing, TLS termination, and upload handling. Nginx and Caddy can satisfy the same application requirements, but their configuration is outside the scope of this document. Next.js recommends placing a reverse proxy in front of a self-hosted Node server, and its Node deployment retains all framework features: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [Next.js deployment modes](https://nextjs.org/docs/app/getting-started/deploying).

PostgreSQL should run on the application VPS for this topology. Docker remains appropriate for untrusted-code sandboxes because their dependency and isolation requirements are materially different from the web application. The reference deployment binds both sandbox APIs only to the sandbox VPS's WireGuard address. Their ports are never published on its public interface, and WireGuard accepts the application VPS as the only peer.

For one class of approximately 40 students, start with 4 vCPU, 8 GB RAM, and at least 75 GB NVMe on each VPS. The supplied sandbox configuration has two Judge0 workers and one Playwright runner limited to 2 vCPU/2 GB. This is intended for ordinary classroom use with intermittent submissions, not an assurance that 40 simultaneous browser or code executions will complete without queueing. Load-test the real activities before a synchronized assessment; the sandbox VPS is the first host to scale when queue latency or browser failures become unacceptable.

Sections 3–13 produce a working Cognelo instance without code execution. Section 14 completes the deployment with Judge0 and the Playwright runner. Keep the dependent plugins disabled until Section 14's smoke tests pass.

## 2. Allocate instance-specific values

Keep a private inventory like this before starting:

| Setting                    |             First instance |             Second example |
| -------------------------- | -------------------------: | -------------------------: |
| Application FQDN           |       `app1.cognelo.org` |       `app2.cognelo.org` |
| Instance key               |                   `app1` |                   `app2` |
| Unix account               |                   `app1` |                   `app2` |
| Web port                   |                   `3100` |                   `3200` |
| API port                   |                   `3101` |                   `3201` |
| Database                   |          `cognelo_app1` |          `cognelo_app2` |
| Database role              |          `cognelo_app1` |          `cognelo_app2` |
| Installation root          |     `/srv/cognelo/app1` |     `/srv/cognelo/app2` |
| Application WireGuard IP   |              `10.80.0.1` |              `10.80.0.5` |
| Sandbox WireGuard IP       |              `10.80.0.2` |              `10.80.0.6` |
| WireGuard subnet           |           `10.80.0.0/30` |           `10.80.0.4/30` |
| Sandbox WireGuard UDP port |                  `51820` |                  `51821` |
| Judge0 port                |                   `2358` |                   `2359` |
| Playwright port            |                   `3456` |                   `3457` |
| Sandbox Compose project    |           `app1-sandbox` |           `app2-sandbox` |

Every instance needs a different web/API port pair, WireGuard subnet and keys, sandbox service ports, database, database role, JWT secret, environment file, and storage directory. Do not reuse a web build between hostnames: `NEXT_PUBLIC_API_URL` is embedded when the web application is built.

## 3. Configure DNS

At the authoritative DNS server for `cognelo.org`, create:

```text
app1.cognelo.org.  A     APPLICATION_PUBLIC_IPV4
```

Create an `AAAA` record only if the Ubuntu server has working public IPv6 and its firewall permits ports 80 and 443 over IPv6. The DNS server does not need to run on the Cognelo host.

Verify propagation from another machine:

```bash
dig +short A app1.cognelo.org
dig +short AAAA app1.cognelo.org
```

Do not request a TLS certificate until the `A`/`AAAA` answers point to the new server and inbound port 80 works.

The sandbox does not need a public application hostname. A name such as `runner1.cognelo.org` may be kept for operator convenience, but Cognelo must not call it and no Apache/Nginx virtual host should expose Judge0 or Playwright there. WireGuard uses the sandbox's fixed public IPv4 endpoint, and Cognelo uses its private WireGuard address.

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
CREATE ROLE cognelo_app1 LOGIN PASSWORD 'PASTE_DATABASE_PASSWORD';
CREATE DATABASE cognelo_app1 OWNER cognelo_app1 ENCODING 'UTF8';
REVOKE ALL ON DATABASE cognelo_app1 FROM PUBLIC;
\connect cognelo_app1
GRANT USAGE, CREATE ON SCHEMA public TO cognelo_app1;
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
  --home-dir /srv/cognelo/app1 \
  --shell /usr/sbin/nologin \
  app1

sudo install -d -m 0750 -o app1 -g app1 \
  /srv/cognelo/app1/deployments \
  /srv/cognelo/app1/shared \
  /srv/cognelo/app1/shared/storage
```

The service account must not be shared by other Cognelo instances.

## 7. Create the production environment file

Create the file with restrictive permissions:

```bash
sudo install -m 0640 -o app1 -g app1 \
  /dev/null /srv/cognelo/app1/shared/.env
sudo nano /srv/cognelo/app1/shared/.env
```

Generate a JWT secret separately:

```bash
openssl rand -hex 48
```

Generate a separate email-credential encryption key and preserve it in protected configuration backups:

```bash
openssl rand -hex 32
```

Use this environment template. Replace every placeholder and keep the public URLs free of trailing slashes:

```dotenv
NODE_ENV=production
DATABASE_URL="postgresql://cognelo_app1:DATABASE_PASSWORD@127.0.0.1:5432/cognelo_app1?schema=public&connection_limit=10&pool_timeout=10"
JWT_SECRET="PASTE_96_CHARACTER_HEX_SECRET"
EMAIL_CREDENTIALS_ENCRYPTION_KEY="PASTE_64_CHARACTER_HEX_KEY"
NEXT_PUBLIC_API_URL="https://app1.cognelo.org"
CORS_ORIGIN="https://app1.cognelo.org"

COGNELO_BACKGROUND_JOBS_DISABLED=false
COGNELO_BACKGROUND_JOBS_CONCURRENCY=1
COGNELO_BACKGROUND_JOBS_INTERVAL_MS=1000
COGNELO_BACKGROUND_JOBS_WORKER_ID="app1-api-worker"

JUDGE0_BASE_URL="http://10.80.0.2:2358"
JUDGE0_AUTH_HEADER="X-Auth-Token"
JUDGE0_AUTH_TOKEN="REPLACE_IF_CODING_EXERCISES_ARE_ENABLED"
JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true

WEB_DESIGN_RUNNER_URL="http://10.80.0.2:3456"
```

These addresses use the WireGuard inventory in Section 2. For another instance, use its allocated WireGuard subnet and sandbox ports. Leave the corresponding activity plugin disabled until that dependency is secured and reachable.

`EMAIL_CREDENTIALS_ENCRYPTION_KEY` encrypts SMTP passwords and Microsoft Graph client secrets stored in the database. It must be unique per Cognelo instance, must not be derived from `JWT_SECRET`, and must remain unchanged while encrypted email credentials exist. Losing it makes those credentials unreadable; restore it together with the database or re-enter the credentials after setting a new key.

After deployment, an administrator configures **Settings → Email delivery**:

- For SMTP, use an authenticated relay, prefer STARTTLS on port 587 or direct TLS on port 465, and use a sender domain authorized by that relay.
- For Microsoft Graph, create a Microsoft Entra application, grant Microsoft Graph `Mail.Send` application permission with administrator consent, create a client secret, and restrict the application to the intended sender mailbox using the institution's current Exchange application-access controls. The configured sender email must identify that mailbox. Microsoft 365 controls the final displayed mailbox name.
- Send the admin test message to an external address and confirm both receipt and authentication results in the received headers.

Transport configuration alone does not establish sender reputation. Publish SPF for the actual relay, enable DKIM through the sending service or Microsoft 365 tenant, and publish an aligned DMARC policy for the visible sender domain. Start DMARC in monitoring mode and tighten it after reviewing reports. Avoid mixing unrelated systems under one sending subdomain, keep mailing lists clean, and investigate repeated bounces before enabling future automated notifications.

Check permissions:

```bash
sudo chown app1:app1 /srv/cognelo/app1/shared/.env
sudo chmod 0640 /srv/cognelo/app1/shared/.env
```

## 8. Deploy a Git tag

Use a deployment key with read-only repository access if the repository is private. Clone the complete repository once for the instance; do not use `--depth 1`. The local history and tags are useful for verifying deployments, comparing versions, and preparing a rollback without depending on a fresh clone.

```bash
sudo -u app1 git clone \
  https://github.com/AnisBoubaker/cognelo.git \
  /srv/cognelo/app1/repository

sudo -u app1 git -C /srv/cognelo/app1/repository \
  fetch --prune --tags
sudo -u app1 git -C /srv/cognelo/app1/repository \
  rev-parse --verify 'refs/tags/cognelo-0.5.0^{commit}'
sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree add --detach \
  /srv/cognelo/app1/deployments/cognelo-0.5.0 \
  refs/tags/cognelo-0.5.0

sudo -u app1 ln -s ../../shared/.env \
  /srv/cognelo/app1/deployments/cognelo-0.5.0/.env
sudo -u app1 ln -s ../../shared/storage \
  /srv/cognelo/app1/deployments/cognelo-0.5.0/storage
```

`cognelo-0.5.0` is the immutable tag selected for this deployment. Annotated, signed tags are recommended and can be verified with `git verify-tag cognelo-0.5.0` when signing is configured. Production tags must not be moved or reused; every deployment candidate receives a new tag.

The `deployments/` directories are filesystem deployment slots, not GitHub Releases. Each one is a detached Git worktree at an exact tag. The storage symlink is mandatory: uploaded course files and homework artifacts currently live below the repository-level `storage/` path, and without the symlink they would be lost when an old deployment is removed.

Install dependencies, generate Prisma clients, verify, and build as the service account:

```bash
sudo -u app1 /bin/bash -c '
  cd /srv/cognelo/app1/deployments/cognelo-0.5.0 &&
  set -a && . ./.env && set +a &&
  npm ci --include=dev &&
  npm run db:generate &&
  npm run typecheck &&
  NEXT_PUBLIC_API_URL="http://localhost:3001" npm test &&
  npm run build
'
```

`--include=dev` is required even though the loaded environment sets `NODE_ENV=production`: TypeScript, Vitest, and other build-time tools are development dependencies. The inline localhost URL applies only to the mocked test process so URL-specific tests remain deterministic; the following build still embeds the production `NEXT_PUBLIC_API_URL` from `.env`.

Builds may report the known Turbopack file-tracing warning caused by plugin Prisma clients. A successful build still ends with both the API and web route summaries.

Apply all core and plugin migrations from the new deployment:

```bash
sudo -u app1 /bin/bash -c '
  cd /srv/cognelo/app1/deployments/cognelo-0.5.0 &&
  set -a && . ./.env && set +a &&
  DATABASE_URL="${DATABASE_URL%%\?*}" node ./scripts/db-migrate-all.mjs
'
```

The `cognelo-0.5.0` migration helper incorrectly leaves Prisma-only query parameters in the URL passed to `psql`; the scoped override removes the query string for this migration process without changing `.env`. Newer source revisions normalize those parameters inside the helper, so future tagged releases can return to `npm run db:migrate:all` directly.

Do not run `npm run db:seed` in production. It creates demonstration users, courses, and content.

Point `current` at the tagged deployment:

```bash
sudo ln -sfn /srv/cognelo/app1/deployments/cognelo-0.5.0 /srv/cognelo/app1/current
sudo chown -h app1:app1 /srv/cognelo/app1/current
```

## 9. Create the first administrator

Cognelo includes a production bootstrap command that creates the standard roles, registers discovered plugins, creates core activity types, and creates the first administrator. It does not add demo data.

Read the password without storing it in shell history:

```bash
read -rsp "Initial administrator password: " COGNELO_INITIAL_ADMIN_PASSWORD
echo

sudo -u app1 env \
  COGNELO_ADMIN_EMAIL="contact@cognelo.org" \
  COGNELO_ADMIN_FIRST_NAME="Anis" \
  COGNELO_ADMIN_LAST_NAME="Boubaker" \
  COGNELO_ADMIN_PASSWORD="$COGNELO_INITIAL_ADMIN_PASSWORD" \
  npm --prefix /srv/cognelo/app1/current run production:bootstrap

unset COGNELO_INITIAL_ADMIN_PASSWORD
```

The bootstrap password must contain at least 12 characters. If the email already exists, the command adds the admin role but deliberately does not reset that account's password.

## 10. Create systemd services

Create `/etc/systemd/system/app1-api.service`:

```ini
[Unit]
Description=Cognelo app1 API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=app1
Group=app1
WorkingDirectory=/srv/cognelo/app1/current/apps/api
EnvironmentFile=/srv/cognelo/app1/shared/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /srv/cognelo/app1/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3101
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

Create `/etc/systemd/system/app1-web.service`:

```ini
[Unit]
Description=Cognelo app1 web
After=network-online.target app1-api.service
Wants=network-online.target

[Service]
Type=simple
User=app1
Group=app1
WorkingDirectory=/srv/cognelo/app1/current/apps/web
EnvironmentFile=/srv/cognelo/app1/shared/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /srv/cognelo/app1/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3100
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
sudo systemctl enable --now app1-api app1-web
sudo systemctl status app1-api --no-pager
sudo systemctl status app1-web --no-pager
```

Verify the private listeners and health endpoint:

```bash
sudo ss -ltnp | grep -E ':(3100|3101)\b'
curl --fail http://127.0.0.1:3101/api/health
curl --head http://127.0.0.1:3100/
```

The health endpoint returns `{"ok":true}` only when the API can query PostgreSQL.

## 11. Configure Apache

Create `/etc/apache2/sites-available/app1.cognelo.org.conf`:

```apache
<VirtualHost *:80>
    ServerName app1.cognelo.org

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

    ErrorLog ${APACHE_LOG_DIR}/app1-cognelo-error.log
    CustomLog ${APACHE_LOG_DIR}/app1-cognelo-access.log combined
</VirtualHost>
```

Apache's `ProxyPass` and `ProxyPassReverse` behavior is documented in the [Apache reverse proxy guide](https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html). `ProxyRequests Off` is important: Cognelo needs a reverse proxy, never an open forward proxy.

Enable and test the site:

```bash
sudo a2ensite app1.cognelo.org.conf
sudo apachectl configtest
sudo systemctl reload apache2
curl --head http://app1.cognelo.org/
curl --fail http://app1.cognelo.org/api/health
```

## 12. Enable HTTPS

Install Certbot using its current Ubuntu/Apache instructions. The Certbot project currently recommends its snap distribution:

```bash
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --apache -d app1.cognelo.org
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
curl --fail https://app1.cognelo.org/api/health
```

## 13. First login and plugin activation

1. Open `https://app1.cognelo.org/login`.
2. Sign in with the bootstrap administrator.
3. Open **Settings → Plugins**.
4. Activate and enable only the plugins needed by this instance.
5. Keep coding-exercise plugins disabled until their sandbox dependency is secured.
6. If the bootstrap credential was communicated to another operator, rotate it with the password-change form under **Settings → Profile**.

## 14. Deploy Judge0 and the Playwright runner

This section is required when the corresponding plugins are enabled:

| Dependency                | Cognelo feature                             | Required application setting           |
| ------------------------- | ------------------------------------------- | -------------------------------------- |
| Judge0                    | Coding exercises                            | `JUDGE0_BASE_URL`, header, and token |
| Cognelo Playwright runner | Web-design coding exercises and screenshots | `WEB_DESIGN_RUNNER_URL`              |

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
sudo apt install -y ca-certificates curl git openssl ufw wireguard
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

This follows Docker's maintained [Ubuntu installation procedure](https://docs.docker.com/engine/install/ubuntu/). Do not enable UFW yet; Section 14.6 adds WireGuard and applies the complete sandbox firewall policy before the execution APIs are made reachable.

Create a system account and directories for the first instance:

```bash
sudo useradd --system --create-home \
  --home-dir /srv/cognelo-sandboxes/app1 \
  --shell /usr/sbin/nologin \
  cognelo-sandbox-app1

sudo install -d -m 0750 \
  -o cognelo-sandbox-app1 -g cognelo-sandbox-app1 \
  /srv/cognelo-sandboxes/app1/repository \
  /srv/cognelo-sandboxes/app1/deployments \
  /srv/cognelo-sandboxes/app1/runtime
```

### 14.2 Check out the same application tag

The runner source and its Playwright dependency belong to the Cognelo tag being deployed. Clone the complete repository and check out that same immutable tag; the example continues to use `cognelo-0.5.0`:

```bash
sudo -u cognelo-sandbox-app1 git clone \
  https://github.com/AnisBoubaker/cognelo.git \
  /srv/cognelo-sandboxes/app1/repository/source

sudo -u cognelo-sandbox-app1 git \
  -C /srv/cognelo-sandboxes/app1/repository/source \
  fetch --prune --tags
sudo -u cognelo-sandbox-app1 git \
  -C /srv/cognelo-sandboxes/app1/repository/source \
  rev-parse --verify 'refs/tags/cognelo-0.5.0^{commit}'
sudo -u cognelo-sandbox-app1 git \
  -C /srv/cognelo-sandboxes/app1/repository/source \
  worktree add --detach \
  /srv/cognelo-sandboxes/app1/deployments/cognelo-0.5.0 \
  refs/tags/cognelo-0.5.0
```

Copy the versioned runtime templates into the instance's persistent runtime directory:

```bash
sudo install -m 0644 \
  /srv/cognelo-sandboxes/app1/deployments/cognelo-0.5.0/infra/production/sandbox.compose.yml \
  /srv/cognelo-sandboxes/app1/runtime/sandbox.compose.yml

sudo install -m 0600 \
  /srv/cognelo-sandboxes/app1/deployments/cognelo-0.5.0/infra/production/judge0.conf.example \
  /srv/cognelo-sandboxes/app1/runtime/judge0.conf
```

### 14.3 Configure Judge0 secrets and limits

Generate four independent values. Copy each output directly to its matching `REPLACE_*` entry in `runtime/judge0.conf`:

```bash
openssl rand -hex 32  # AUTHN_TOKEN; also copied to Cognelo's JUDGE0_AUTH_TOKEN
openssl rand -hex 32  # REDIS_PASSWORD
openssl rand -hex 32  # POSTGRES_PASSWORD
openssl rand -hex 64  # SECRET_KEY_BASE

sudo nano /srv/cognelo-sandboxes/app1/runtime/judge0.conf
sudo grep -n 'REPLACE_' /srv/cognelo-sandboxes/app1/runtime/judge0.conf
```

The final `grep` must print nothing. Preserve the Judge0 authentication token in the application host's `/srv/cognelo/app1/shared/.env`:

```dotenv
JUDGE0_BASE_URL="http://10.80.0.2:2358"
JUDGE0_AUTH_HEADER="X-Auth-Token"
JUDGE0_AUTH_TOKEN="PASTE_THE_SAME_AUTHN_TOKEN"
JUDGE0_ENABLE_PER_PROCESS_AND_THREAD_LIMITS=true
```

The supplied Judge0 configuration enables the synchronous `wait=true` submissions Cognelo uses, permits Cognelo's per-process/thread limit flags, caps CPU at 5 seconds, wall time at 10 seconds, and memory at 128 MB, and disables submission networking, callbacks, command-line arguments, compiler options, batch requests, and additional files. Review these limits when Cognelo's execution contract changes. Judge0's complete option reference is its [versioned configuration file](https://github.com/judge0/judge0/blob/v1.13.1/judge0.conf).

### 14.4 Build the pinned Playwright runner

The repository currently depends on `@playwright/test` `1.59.1`, so the production Dockerfile deliberately uses `mcr.microsoft.com/playwright:v1.59.1-noble`. Playwright requires the image and package versions to match; update both in source and test them together rather than changing only the container tag. See [Playwright's Docker version guidance](https://playwright.dev/docs/docker#image-tags).

Build a local immutable image from the selected Cognelo tag:

```bash
cd /srv/cognelo-sandboxes/app1/deployments/cognelo-0.5.0
sudo docker build \
  --file infra/production/web-design-runner.Dockerfile \
  --tag cognelo/web-design-runner:cognelo-0.5.0 \
  .
sudo docker image inspect cognelo/web-design-runner:cognelo-0.5.0 \
  --format '{{.Id}}'
```

Download the seccomp profile from the same Playwright release and record its checksum:

```bash
sudo curl -fsSLo /srv/cognelo-sandboxes/app1/runtime/seccomp_profile.json \
  https://raw.githubusercontent.com/microsoft/playwright/v1.59.1/utils/docker/seccomp_profile.json
sudo chmod 0644 /srv/cognelo-sandboxes/app1/runtime/seccomp_profile.json
sha256sum /srv/cognelo-sandboxes/app1/runtime/seccomp_profile.json
```

Microsoft's image includes browser binaries and system dependencies but not the Node package. The Cognelo image adds the locked runner package, switches to `pwuser`, and starts only the runner. The Compose service adds the Chromium seccomp profile, drops Linux capabilities, makes the root filesystem read-only, gives Chromium bounded temporary storage, and applies CPU, memory, and PID limits. The official image alone is not a complete security boundary for untrusted content; the dedicated host and blocked outbound network are also required. See [Playwright's Docker security notes](https://playwright.dev/docs/docker#run-the-image).

### 14.5 Configure the sandbox stack

Create `/srv/cognelo-sandboxes/app1/runtime/.env`:

```dotenv
COMPOSE_PROJECT_NAME=app1-sandbox
SANDBOX_BIND_ADDRESS=10.80.0.2
JUDGE0_PORT=2358
WEB_DESIGN_RUNNER_PORT=3456
JUDGE0_IMAGE=judge0/judge0:1.13.1
WEB_DESIGN_RUNNER_IMAGE=cognelo/web-design-runner:cognelo-0.5.0
PLAYWRIGHT_SECCOMP_PROFILE=/srv/cognelo-sandboxes/app1/runtime/seccomp_profile.json
```

Set restrictive permissions, validate the resolved Compose model, and pull the pinned upstream images:

```bash
sudo chmod 0600 /srv/cognelo-sandboxes/app1/runtime/.env
cd /srv/cognelo-sandboxes/app1/runtime

sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml \
  pull judge0-server judge0-workers judge0-db judge0-redis
```

`judge0/judge0:1.13.1`, `postgres:16.2`, `redis:7.2.4`, and the Playwright base image are pinned rather than `latest`. For even stricter supply-chain control, replace each tag with the image digest printed by `docker image inspect --format '{{index .RepoDigests 0}}' IMAGE` after the first approved pull.

Do not start the stack until the sandbox WireGuard address exists in Section 14.6; Docker cannot bind `10.80.0.2` before that interface is up.

### 14.6 Create the WireGuard point-to-point network

WireGuard gives the two VPSs stable private addresses over their fixed public IPs. The application VPS initiates the tunnel to the sandbox VPS. Judge0 and Playwright bind only to the sandbox WireGuard address, and the sandbox firewall admits those ports only from the application WireGuard address.

Ubuntu documents `wg-quick@INTERFACE` as the systemd-managed mechanism for bringing a permanent WireGuard interface back after reboot: [Ubuntu WireGuard common tasks](https://ubuntu.com/server/docs/how-to/wireguard-vpn/common-tasks/) and [site-to-site configuration](https://documentation.ubuntu.com/server/how-to/wireguard-vpn/site-to-site/).

Install WireGuard on the **application host**; it was installed on the sandbox host in Section 14.1:

```bash
sudo apt update
sudo apt install -y wireguard
```

On **each host**, generate an independent private key and print only its derived public key for exchange:

```bash
sudo install -d -m 0700 /etc/wireguard
sudo sh -c 'umask 077; wg genkey > /etc/wireguard/private.key'
sudo sh -c 'wg pubkey < /etc/wireguard/private.key'
```

Record which public key belongs to which host. Never copy either `private.key` off its host or include it in documentation, backups without encryption, shell history, or support messages.

Create `/etc/wireguard/wg0.conf` on the **application host**:

```ini
[Interface]
Address = 10.80.0.1/30
PostUp = wg set %i private-key /etc/wireguard/private.key

[Peer]
PublicKey = SANDBOX_WIREGUARD_PUBLIC_KEY
AllowedIPs = 10.80.0.2/32
Endpoint = SANDBOX_PUBLIC_IPV4:51820
PersistentKeepalive = 25
```

Create `/etc/wireguard/wg0.conf` on the **sandbox host**:

```ini
[Interface]
Address = 10.80.0.2/30
ListenPort = 51820
PostUp = wg set %i private-key /etc/wireguard/private.key

[Peer]
PublicKey = APPLICATION_WIREGUARD_PUBLIC_KEY
AllowedIPs = 10.80.0.1/32
```

Protect both configuration files:

```bash
sudo chmod 0600 /etc/wireguard/wg0.conf /etc/wireguard/private.key
```

Configure the **sandbox host** firewall. Replace `APPLICATION_PUBLIC_IPV4` and `ADMIN_CIDR` before running these commands. `ADMIN_CIDR` should be the smallest stable source range from which administrators connect; do not lock out the current SSH session before validating it:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from ADMIN_CIDR to any port 22 proto tcp
sudo ufw allow from APPLICATION_PUBLIC_IPV4 to any port 51820 proto udp
sudo ufw allow in on wg0 from 10.80.0.1 to 10.80.0.2 port 2358 proto tcp
sudo ufw allow in on wg0 from 10.80.0.1 to 10.80.0.2 port 3456 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Do not add public-interface rules for `2358` or `3456`. Docker-published ports must still bind specifically to `10.80.0.2`; firewall rules are defense in depth, not a substitute for interface-specific binding.

Enable WireGuard first on the sandbox host and then on the application host:

```bash
sudo systemctl enable --now wg-quick@wg0
sudo systemctl status wg-quick@wg0 --no-pager
sudo wg show wg0
```

Because Docker publishes the sandbox APIs specifically on `10.80.0.2`, make the dedicated sandbox host's Docker service depend on that address existing after every reboot. On the sandbox host, create `/etc/systemd/system/docker.service.d/wireguard.conf`:

```ini
[Unit]
After=wg-quick@wg0.service
Requires=wg-quick@wg0.service
```

This sandbox VPS is dedicated to workloads that require `wg0`, so preventing Docker from starting when WireGuard configuration is broken is safer than starting containers with failed port bindings. Load the dependency now; restarting Docker is safe here because the sandbox stack has not been started yet:

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
sudo systemctl status docker --no-pager
```

From the application host, verify that the peer has completed an authenticated handshake:

```bash
sudo wg show wg0
```

`PersistentKeepalive` should produce a recent handshake within approximately 25 seconds even before the sandbox services start. If it does not, verify both public keys, `AllowedIPs`, the sandbox endpoint address, UDP `51820`, and the sandbox UFW rule. Section 14.7 verifies actual TCP service traffic after the containers start.

Make the Cognelo API start after WireGuard without making the whole application unavailable when the sandbox is down. Create `/etc/systemd/system/app1-api.service.d/sandbox.conf` on the application host:

```ini
[Unit]
After=wg-quick@wg0.service
Wants=wg-quick@wg0.service
```

`Wants`, rather than `Requires`, is intentional: MCQ, Parsons, content, administration, and other non-sandbox features should still start if the sandbox VPS is temporarily unavailable.

```bash
sudo systemctl daemon-reload
sudo systemctl restart app1-api
```

### 14.7 Run end-to-end sandbox smoke tests

On the sandbox host, start Judge0's data services first, inspect them, and then start the complete stack:

```bash
cd /srv/cognelo-sandboxes/app1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d judge0-db judge0-redis
sudo docker compose --env-file .env -f sandbox.compose.yml ps
sudo docker compose --env-file .env -f sandbox.compose.yml \
  logs --tail=100 judge0-db judge0-redis

sudo docker compose --env-file .env -f sandbox.compose.yml up -d
sudo docker compose --env-file .env -f sandbox.compose.yml ps
sudo docker compose --env-file .env -f sandbox.compose.yml logs --tail=200
sudo ss -ltnp | grep -E '10\.80\.0\.2:(2358|3456)\b'
curl --fail http://10.80.0.2:3456/health
```

Both published ports must show only `10.80.0.2`, never `0.0.0.0`, `[::]`, or the sandbox public address. The Compose network is marked `internal`, so neither learner code nor Chromium can make outbound requests. Consequently, web-design exercises must include required HTML, CSS, JavaScript, and other assets rather than loading them from CDNs.

On the application host, verify an actual Judge0 compilation/execution over WireGuard. This example discovers the installed Python 3 language ID instead of hard-coding one:

```bash
sudo apt install -y jq
read -rsp "Judge0 AUTHN_TOKEN: " JUDGE0_SMOKE_TOKEN
echo

PYTHON_LANGUAGE_ID=$(
  curl --fail --silent --show-error \
    --header "X-Auth-Token: ${JUDGE0_SMOKE_TOKEN}" \
    http://10.80.0.2:2358/languages \
  | jq -r '[.[] | select(.name | startswith("Python (3"))][0].id'
)
test -n "${PYTHON_LANGUAGE_ID}" && test "${PYTHON_LANGUAGE_ID}" != "null"

curl --fail --silent --show-error \
  --request POST \
  --header "Content-Type: application/json" \
  --header "X-Auth-Token: ${JUDGE0_SMOKE_TOKEN}" \
  --data "{\"language_id\":${PYTHON_LANGUAGE_ID},\"source_code\":\"print(2 + 3)\",\"expected_output\":\"5\"}" \
  'http://10.80.0.2:2358/submissions?base64_encoded=false&wait=true' \
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
  http://10.80.0.2:3456/run \
  | jq
rm /tmp/cognelo-runner-smoke.json
```

The runner result must report `status: "completed"`, `score: 1`, and `maxScore: 1`. Finally:

1. restart the sandbox host and application host separately;
2. confirm the Compose stack and both `wg-quick@wg0` units return automatically;
3. activate the required plugins under **Settings → Plugins**;
4. submit one small coding exercise and one web-design exercise through the Cognelo UI;
5. confirm both results reach the gradebook.

### 14.8 Same-host fallback

For a small non-production installation with only one Ubuntu server, the same Compose project can run there with `SANDBOX_BIND_ADDRESS=127.0.0.1`; omit WireGuard and use loopback URLs in Cognelo's `.env`. This is operationally simpler, but Judge0's server and worker containers are privileged. A container escape or kernel vulnerability would then place Cognelo, PostgreSQL, uploaded files, and every co-located instance in the same failure domain. The two-VPS deployment is therefore the production reference, not merely a performance optimization.

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
11. create a separate sandbox Compose project, Judge0 database volume, and Judge0 token;
12. assign an unused WireGuard interface/subnet and unused Judge0 and runner ports.

For example, keep `app1` on Judge0 `2358` and runner `3456`, then use `2359` and `3457` for `app2`. Its sandbox `runtime/.env` contains:

```dotenv
COMPOSE_PROJECT_NAME=app2-sandbox
SANDBOX_BIND_ADDRESS=10.80.0.6
JUDGE0_PORT=2359
WEB_DESIGN_RUNNER_PORT=3457
JUDGE0_IMAGE=judge0/judge0:1.13.1
WEB_DESIGN_RUNNER_IMAGE=cognelo/web-design-runner:cognelo-0.5.0
PLAYWRIGHT_SECCOMP_PROFILE=/srv/cognelo-sandboxes/app2/runtime/seccomp_profile.json
```

Use a separate WireGuard interface such as `wg1` with application address `10.80.0.5/30`, sandbox address `10.80.0.6/30`, and sandbox UDP port `51821`. Extend the sandbox firewall with only that peer and those instance-specific service ports. Its application `.env` uses:

```dotenv
JUDGE0_BASE_URL="http://10.80.0.6:2359"
WEB_DESIGN_RUNNER_URL="http://10.80.0.6:3457"
```

Do not share a Judge0 token, Compose project, WireGuard keys, or WireGuard subnet between instances. Separate projects avoid cross-instance database, queue, capacity, and lifecycle coupling. The same locally built runner image may be reused only when both instances run the exact same Cognelo tag.

Useful collision checks:

```bash
sudo ss -ltnp
sudo -u postgres psql -c '\l'
sudo -u postgres psql -c '\du'
systemctl list-units 'cognelo-*'
sudo apachectl -S
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Multiple instances may share the application host's PostgreSQL service and Apache process and may use the same dedicated sandbox VM, but they do not share databases, files, sessions, service accounts, Node processes, Compose projects, Judge0 state, WireGuard subnets, or WireGuard keys.

## 16. Backups

Back up both PostgreSQL and `shared/storage`. A database-only backup is incomplete because uploaded bytes live on disk.

Example manual backup:

```bash
sudo install -d -m 0700 /var/backups/cognelo/app1

sudo -u postgres pg_dump \
  --format=custom \
  --file=/var/backups/cognelo/app1/database-$(date +%F-%H%M%S).dump \
  cognelo_app1

sudo tar -C /srv/cognelo/app1/shared \
  -czf /var/backups/cognelo/app1/storage-$(date +%F-%H%M%S).tar.gz \
  storage
```

Copy backups to encrypted off-host storage, define retention, and test restores regularly. For a strict point-in-time pair, briefly stop the API while taking both backups:

```bash
sudo systemctl stop app1-api
# Run pg_dump and the storage archive.
sudo systemctl start app1-api
```

The Playwright runner is stateless and is rebuilt from a Cognelo tag. Preserve the sandbox `runtime/.env`, `judge0.conf`, encrypted WireGuard configuration/key backups, image digests, and seccomp checksum in the protected configuration backup. Cognelo stores grading outcomes in its own database, so Judge0's submission database is not part of the authoritative Cognelo backup. If an organization nevertheless requires Judge0 submission retention, dump its container database separately:

```bash
cd /srv/cognelo-sandboxes/app1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml \
  exec -T judge0-db pg_dump -U judge0 -Fc judge0 \
  > /var/backups/cognelo/app1/judge0-$(date +%F-%H%M%S).dump
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

For the practical tagged-release procedure, including a database backup, optional sandbox coordination, migration, smoke testing, and rollback, follow [DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md](DEPLOYMENT_UPGRADE_UBUNTU_APACHE.md). It keeps the shared storage in place rather than copying it for every routine upgrade. The steps below are only a concise summary.

Do not begin an upgrade unless that tag's GitHub Release includes the complete **Upgrade from the previous release** section defined by [RELEASE_NOTES_TEMPLATE.md](RELEASE_NOTES_TEMPLATE.md). Release authors must identify all manual and compatibility requirements; production operators are not expected to derive them from changed files.

Never build over the active deployment and never deploy a mutable branch head such as `main` directly.

1. Create and push a new immutable Git tag for the version being deployed.
2. Fetch and resolve that tag in the instance repository.
3. Create a detached worktree in `deployments/<tag>`.
4. Link its `.env` and `storage` to `shared`.
5. Run `npm ci --include=dev`, Prisma generation, typecheck, tests with the deterministic localhost API URL, and the production build.
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

Example runner update for a future `cognelo-0.6.0` tag on the sandbox host:

```bash
cd /srv/cognelo-sandboxes/app1/deployments/cognelo-0.6.0
sudo docker build \
  --file infra/production/web-design-runner.Dockerfile \
  --tag cognelo/web-design-runner:cognelo-0.6.0 \
  .

sudo nano /srv/cognelo-sandboxes/app1/runtime/.env
cd /srv/cognelo-sandboxes/app1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml config --quiet
sudo docker compose --env-file .env -f sandbox.compose.yml \
  up -d --no-deps web-design-runner
curl --fail http://10.80.0.2:3456/health
```

Judge0, PostgreSQL, Redis, and Playwright base-image upgrades are separate dependency upgrades, not routine restarts. Change a pinned version in a reviewed Cognelo tag, read its upstream migration notes, back up any retained Judge0 data, pull/build it, run the smoke tests, and then roll it into production. Never use an unattended `docker compose pull` against mutable tags.

Example update to a future `cognelo-0.6.0` tag:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  fetch --prune --tags
sudo -u app1 git -C /srv/cognelo/app1/repository \
  rev-parse --verify 'refs/tags/cognelo-0.6.0^{commit}'
sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree add --detach \
  /srv/cognelo/app1/deployments/cognelo-0.6.0 \
  refs/tags/cognelo-0.6.0

sudo -u app1 ln -s ../../shared/.env \
  /srv/cognelo/app1/deployments/cognelo-0.6.0/.env
sudo -u app1 ln -s ../../shared/storage \
  /srv/cognelo/app1/deployments/cognelo-0.6.0/storage

sudo -u app1 /bin/bash -c '
  cd /srv/cognelo/app1/deployments/cognelo-0.6.0 &&
  set -a && . ./.env && set +a &&
  npm ci --include=dev &&
  npm run db:generate &&
  npm run typecheck &&
  NEXT_PUBLIC_API_URL="http://localhost:3001" npm test &&
  npm run build
'

sudo systemctl stop app1-api
sudo -u app1 /bin/bash -c '
  cd /srv/cognelo/app1/deployments/cognelo-0.6.0 &&
  npm run db:migrate:all
'
sudo ln -sfn /srv/cognelo/app1/deployments/cognelo-0.6.0 /srv/cognelo/app1/current
sudo chown -h app1:app1 /srv/cognelo/app1/current
sudo systemctl restart app1-api app1-web
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://app1.cognelo.org/api/health
```

Code rollback is a symlink switch to a previous tag only when the new database migrations are backward-compatible. Otherwise restore the pre-deployment database and storage backups before starting the previous tagged deployment.

After a deployment is accepted and no longer needed for rollback, remove its worktree through Git rather than deleting it by hand:

```bash
sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree remove /srv/cognelo/app1/deployments/cognelo-0.5.0
sudo -u app1 git -C /srv/cognelo/app1/repository \
  worktree prune
```

## 18. Logs and troubleshooting

```bash
# Node services
sudo journalctl -u app1-api -n 200 --no-pager
sudo journalctl -u app1-web -n 200 --no-pager
sudo journalctl -u app1-api -f

# Apache
sudo tail -f /var/log/apache2/app1-cognelo-error.log
sudo tail -f /var/log/apache2/app1-cognelo-access.log

# PostgreSQL
sudo journalctl -u postgresql -n 200 --no-pager

# WireGuard on both hosts
sudo journalctl -u wg-quick@wg0 -n 200 --no-pager
sudo systemctl status wg-quick@wg0 --no-pager
sudo wg show wg0

# Configuration and listeners
sudo apachectl configtest
sudo apachectl -S
sudo ss -ltnp

# Service and application health
systemctl is-active app1-api app1-web apache2 postgresql
curl --fail http://127.0.0.1:3101/api/health
curl --fail https://app1.cognelo.org/api/health
```

On the sandbox host:

```bash
cd /srv/cognelo-sandboxes/app1/runtime
sudo docker compose --env-file .env -f sandbox.compose.yml ps
sudo docker compose --env-file .env -f sandbox.compose.yml logs --tail=200
sudo docker compose --env-file .env -f sandbox.compose.yml logs -f judge0-server judge0-workers
sudo docker compose --env-file .env -f sandbox.compose.yml logs -f web-design-runner
sudo docker stats
sudo ss -ltnp | grep -E '10\.80\.0\.2:(2358|3456)\b'
curl --fail http://10.80.0.2:3456/health
```

Common failure causes:

- `502 Proxy Error`: the mapped Node process is stopped or the Apache port does not match systemd.
- API health returns `500`: inspect the API journal and verify `DATABASE_URL`, database ownership, and migrations.
- Login succeeds locally but not publicly: verify `NODE_ENV=production`, HTTPS, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, and that the web build used the production `.env`.
- Upload succeeds but files disappear after deployment: the deployment's `storage` symlink is missing or points to the wrong instance.
- A plugin is absent from the picker: activate and enable it in administrator settings; also verify its external dependency when applicable.
- Browser calls the wrong hostname: rebuild the web application after correcting `NEXT_PUBLIC_API_URL`; changing it only at runtime is insufficient.
- Email configuration cannot save or test a credential: verify that `EMAIL_CREDENTIALS_ENCRYPTION_KEY` contains the same 64 hexadecimal characters used when the secret was stored, then inspect the API journal.
- SMTP or Microsoft Graph rejects a test: verify relay credentials and TLS settings, or the Entra tenant/application IDs, client-secret validity, `Mail.Send` administrator consent, sender-mailbox access policy, and sender address.
- Email arrives in spam: verify SPF, DKIM, and DMARC alignment for the visible sender domain and inspect the message authentication headers; changing Cognelo's transport alone does not repair domain reputation.
- `ECONNREFUSED` for Judge0 or the runner: check the latest handshake with `wg show wg0` on the application host, then the WireGuard/UFW configuration and `docker compose ps` and logs on the sandbox host.
- Judge0 returns `401 Unauthorized`: ensure `AUTHN_TOKEN` in `judge0.conf` exactly matches `JUDGE0_AUTH_TOKEN` in the instance `.env`, then restart the API after correcting it.
- Judge0 returns a limit validation error: compare the limits sent by the coding-exercise plugin with `MAX_*` and `ALLOW_ENABLE_*` in `judge0.conf`.
- Chromium fails to launch: verify the runner image version matches `@playwright/test`, the official seccomp profile is readable, and the container is running as `pwuser`; inspect runner logs before changing security options.
- A web-design exercise cannot load an external font, script, or image: expected in the hardened deployment; the runner has no outbound network. Include required assets in the exercise instead.

## 19. Production security checklist

- Use SSH keys and restrict SSH source addresses where practical.
- Keep Ubuntu, Node.js, Apache, PostgreSQL, and sandbox images patched.
- On the application host expose only 22, 80, and 443. On the sandbox host expose only restricted SSH and WireGuard UDP from the application public IP. Restrict SSH source addresses where possible.
- Keep PostgreSQL and Node listeners on loopback.
- Use a unique JWT secret and database credentials per instance.
- Use a unique email-credential encryption key per instance, protect it with `.env` backups, and never rotate or remove it without replacing stored email credentials.
- Protect `.env`, backups, and deploy keys; never commit them.
- Do not run production services as root.
- Do not use the development seed in production.
- Do not deploy the development runner Compose configuration as production.
- Keep untrusted code execution off the database/application host when possible.
- Bind sandbox APIs only to their sandbox WireGuard address, never to the public interface; allow those ports on `wg0` only from the matching application WireGuard address.
- Keep each instance's sandbox Compose project, Judge0 token, ports, volume, WireGuard subnet, and WireGuard keys separate.
- Run the Playwright runner as `pwuser` with the checked-in resource limits and the matching official seccomp profile.
- Keep the sandbox Compose network internal; do not grant learner executions outbound access without a separately reviewed proxy policy.
- Pin sandbox images and record approved image digests; do not deploy `latest`.
- Configure off-host backups and verify restoration.
- Review Apache and authentication logs. Cognelo does not yet provide centralized login rate limiting, so add edge/WAF controls before exposing a high-risk public instance.
- Test certificate renewal with `certbot renew --dry-run` after every TLS configuration change.

## 20. Deployment acceptance checklist

- [ ] DNS resolves only to intended addresses.
- [ ] UFW exposes only approved public ports.
- [ ] PostgreSQL, direct Node web/API listeners, Judge0, and the Playwright runner are not publicly reachable; only Apache exposes Cognelo over HTTPS.
- [ ] Core and plugin migrations complete without errors.
- [ ] `/api/health` succeeds locally and through HTTPS.
- [ ] The administrator can sign in and change their password.
- [ ] The administrator can save the chosen email route and deliver a test to an external address; received headers show expected SPF, DKIM, and DMARC results.
- [ ] Required plugins are activated and enabled; unused plugins remain disabled.
- [ ] An uploaded file survives a service restart and deployment switch.
- [ ] A representative student submission reaches the gradebook.
- [ ] Sandbox containers bind only to the sandbox WireGuard address and have no outbound network.
- [ ] Both WireGuard interfaces return automatically after reboot, show a recent handshake, and expose no sandbox API on the public interface.
- [ ] Judge0 authentication rejects a missing/incorrect token and accepts the configured token.
- [ ] The Judge0 Python execution smoke test returns `Accepted` and `5`.
- [ ] The Playwright runner smoke test reports `completed`, `1 / 1`.
- [ ] One real coding exercise and one real web-design exercise reach the gradebook.
- [ ] Database and storage backups complete and exist off-host.
- [ ] Logs contain no secrets or recurring startup errors.
