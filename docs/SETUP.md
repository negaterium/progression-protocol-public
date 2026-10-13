# First installation and configuration

The application runs on port 9999 and connects to **separately managed PostgreSQL**.
This workflow installs a new instance. Keep your existing deployment's environment
files and database unchanged; the fresh initializer is not an upgrade tool.

## Prerequisites

- Node.js 22 LTS, version 22.20 or a newer 22.x patch, with npm. `.nvmrc` and
  `.node-version` select 22; the Dockerfile uses the same runtime line.
  [Node's release schedule](https://github.com/nodejs/Release) lists its support window.
- PostgreSQL 17 with an empty dedicated database and its owning login role,
  provisioned by your database administrator. Do not use a superuser as the app role.
- Network access for `npm ci` and, during builds, the Google fonts used by the UI.
  The current PostgreSQL pool expects a trusted private network or secured tunnel;
  custom remote TLS connection options are not implemented.
- Docker is optional for development. It is required for the isolated verification
  commands and app container deployment, and does not manage the production database.

## Clone, install, configure, initialize, launch

Clone your chosen repository URL into a new directory, then install the lockfile:

```sh
git clone https://github.com/negaterium/progression-protocol-public.git progression-protocol
cd progression-protocol
npm ci
```

Copy the development template to a new local file. Do not overwrite an existing
configuration. On Linux/macOS:

```sh
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Edit the **copy** with your PostgreSQL host, database name, login role and password.
Replace `replace_me` with the actual database credential through your editor or
secret manager. Keep developer privileges and authentication overrides disabled
for normal login. Leave the original templates free of credentials.

Check syntax without contacting PostgreSQL:

```sh
npm run config:check -- --env-file .env.local --mode development
```

For your **new empty database**, run the packaged schema initializer and create a
player. The database name after `--target-database` must exactly match the effective
`POSTGRES_DATABASE` setting; the example below uses the template's default name.

```sh
npm run db:init -- --target-database progression_protocol --confirm --env-file .env.local
npm run db:create-user -- hunter --target-database progression_protocol --env-file .env.local
npm run config:doctor -- --env-file .env.local --mode development
npm run dev
```

The player command prompts for a password without echoing it. Use at least eight
characters and at most 72 UTF-8 bytes; do not put the password in command arguments.
Open [http://localhost:9999/login](http://localhost:9999/login) and sign in with that
player. The dashboard should show level 1, full HP/MP and zero XP/gold. Shared quests,
items, skills and bosses come from the packaged catalogs.

Fresh-install examples use the `progression_protocol` database name. Existing
deployments may keep the legacy `solo_leveling_system` database name; database
identifiers are compatibility details and should not be renamed solely for branding.

`config:doctor` uses a read-only PostgreSQL connection. It checks reachability,
version and app-table permissions without querying player records or modifying data.
It is meant to run **after** initialization. The server's startup check validates
configuration syntax only; it does not migrate, seed or provision users.
The npm dev/start commands run a preflight before launching Next.js. The Docker
entrypoint checks the compiled validator before launching generated `server.js`.
Next instrumentation also protects requests when Next is launched directly.

## Environment settings

All settings below are server-side. Never use a `NEXT_PUBLIC_` prefix for credentials
or authentication controls. Legacy public authentication switches are ignored.

| Setting | Required/default | Meaning |
| --- | --- | --- |
| `POSTGRES_HOST` | Required | Hostname/IP of separately managed PostgreSQL, or a local Unix socket directory. No surrounding whitespace. Inside an app container, `localhost` refers to that container. |
| `POSTGRES_PORT` | `5432` | Integer from 1 to 65535. Empty values, suffixes and decimal notation are rejected. |
| `POSTGRES_DATABASE` | Required | Name of an existing database. Provision an empty one for a fresh installation. |
| `POSTGRES_USER` | Required | PostgreSQL login role; the fresh-install workflow uses a role that owns the database/schema objects. |
| `POSTGRES_PASSWORD` | Required | Database credential. Empty values and known template placeholders are rejected. The value is never printed by configuration tools. |
| `USE_SECURE_COOKIES` | Unset: `true` in production, `false` in development | Exactly `true` or `false`. Production HTTPS uses `true`; explicit `false` is reserved for HTTP on a trusted private network. Secure cookies on ordinary HTTP can prevent login. |
| `SLS_DEVELOPER_USER_IDS` | Empty, denies all | Comma-separated existing user UUIDs allowed to use developer tools. Names/emails never grant access. A malformed list stops startup. |
| `SLS_ENABLE_DEV_AUTH` | `false` | Exactly `true` or `false`. An override requires development mode and an existing `SLS_DEV_USER_ID`; enabling it in production/test is rejected. |
| `SLS_DEV_USER_ID` | Empty/unset | Valid existing profile UUID when the development authentication override is enabled. Does not grant developer privileges. Ordinary `/login` and dashboard session redirects still require a session. |
| `SLS_TRUST_PROXY_HEADERS` | `false` | Exactly `true` or `false`. Enable only if the app is reachable exclusively through a trusted proxy that overwrites `X-Real-IP`. |
| `NODE_ENV` | Managed by Next.js / production image | Do not set it in the local template. `dev`, `build` and `start` choose the appropriate mode. Configuration checks accept `--mode development` or `--mode production`. |
| `PORT` | Standalone image: `9999` | Used by generated `server.js`; the npm dev/start commands use `-p 9999`. An explicitly supplied value must be a valid port. |
| `HOSTNAME` | Standalone image: `0.0.0.0` | Bind address for generated `server.js`; this is not the database host. Next CLI bind addresses use `--hostname`. |

The `SLS_*` environment variable names, `sls_*` PostgreSQL schema identifiers,
and `sls_session` cookie name are stable compatibility keys retained from earlier
deployments. They are internal identifiers and do not change the Progression Protocol
branding.

For local development, `npm run dev -- --hostname 127.0.0.1` restricts the listener
to loopback. The default npm command retains the existing port/bind behavior.

### Which settings are loaded

Next.js loads process settings first, followed by `.env.<mode>.local`, `.env.local`,
`.env.<mode>` and `.env`, filling settings not already present. `.env.local` is
skipped in test mode. This is [Next.js's documented environment precedence](https://nextjs.org/docs/app/guides/environment-variables#environment-variable-load-order).

The database and configuration CLIs load **only** the file explicitly selected by
`--env-file`. Without that option, they use process environment variables. Existing
process variables take precedence over a selected file, matching the app's behavior.
If the CLI refuses a target database unexpectedly, check your terminal's injected
settings without printing secrets. Avoid mixing competing configuration files.
Both loaders use Next's parsing/expansion rules. Escape a literal dollar sign as
`\$` in files, including database passwords; process-injected values are taken
literally. The development preflight leaves file loading to the Next child process
so its usual environment-file reload behavior remains available.

Do not commit real environment files or copy them into image builds. Only
`.env.example` and `.env.docker.example` are public templates; they are included in
the source secret scan. `.dockerignore` excludes every environment file/template.

## Existing deployment and Docker configuration

Keep using your current PostgreSQL database. Do not copy templates over its
configuration, run `db:init` against it or provision replacement accounts.
You can explicitly check settings without changing them:

```sh
npm run config:check -- --env-file .env.local --mode development
```

For an app-only production Compose deployment, use `.env.docker.example` as the
template for `.env`, then check it with:

```sh
npm run config:check -- --env-file .env --mode production
```

Compose interpolates the complete service definition before running any command,
so the required `POSTGRES_*` settings must exist even for `docker compose build`.
Prepare the private file first, then build and run with the same explicit file:

```sh
umask 077
test ! -e .env && cp .env.docker.example .env
chmod 600 .env
# Edit .env through an editor or secret manager before launching.
docker compose --env-file .env build
docker compose --env-file .env up -d
```

If you only need a configuration-independent image build, use Docker directly;
the Dockerfile does not need PostgreSQL settings during the image build:

```sh
docker build --tag progression-protocol:local .
```

Compose supplies `NODE_ENV=production`, `PORT=9999` and `SLS_ENABLE_DEV_AUTH=false`.
It forwards the external database settings, cookie policy, developer IDs and proxy
trust settings. There is no PostgreSQL service in Compose. Database/provisioning
tools run from a source checkout with development dependencies, not the standalone
runtime image. See [database operations](../database/README.md) and the
[deployment guide](../DEPLOYMENT.md) for production proxy/HTTPS, updates, full
backups and recovery. The opt-in `compose.production.yml` binds host loopback;
the legacy `docker-compose.yml` keeps its existing direct-port behavior.
Compose and Next.js use different file interpolation rules for literal dollar
signs; follow the deployment guide when sharing configuration between them.

## Checks and troubleshooting

```sh
npm run config:check -- --env-file .env.local
npm run config:doctor -- --env-file .env.local
npm run setup:verify
```

`setup:verify` copies the current source to ignored `scratch`, excludes installed
dependencies and real environment files, and builds the Node.js 22 app image with
a fresh `npm ci`. It applies the documented commands to a disposable PostgreSQL
17 container on a private test network, creates a synthetic player and verifies
the standalone app's public login page and authenticated pages. Passwords are
generated and never displayed. Authentication probes use a short-lived synthetic
session after bcrypt verification; the browser login form is a separate smoke test.
Only the test app is exposed on a random loopback port. The verifier removes its
containers, network and image tags afterward; source copies/build logs remain in
ignored `scratch`. It never contacts the deployment database or changes port 9999.
The default run bypasses Docker build cache. For subsequent checks, add
`-- --use-build-cache` to reuse layers created from the same lockfile; source and
configuration isolation remain unchanged. Docker build cache is not pruned.

| Failure | Next step |
| --- | --- |
| `Invalid configuration: ...` | Fix the named settings using the table above. Values are deliberately omitted from the error. |
| Template password rejected | Replace the placeholder in the private copy. Do not edit the example file with a real credential. |
| Doctor cannot connect | Check database availability, network routing, firewall and role credentials through your administrator. Raw connection details are not printed. |
| Doctor reports missing tables | Initialize only a new empty database. Existing databases need the reviewed `db:migrate` path for the selected release, or an operator-approved recovery plan. |
| Login succeeds but returns to login on HTTP | Check whether Secure cookies are enabled; use HTTPS or an explicit trusted-network HTTP setting. |
| Developer tools disappeared after update | Configure authorized user UUIDs explicitly. Creating an account does not grant developer privileges. |
| Font download fails during build | Restore build-time network access to the Google fonts used by the UI. |
| `npm ci` reports an unsupported engine | Select a recent Node.js 22 LTS patch. Do not regenerate the lockfile to bypass the requirement. |

Keep configuration syntax errors, database connectivity problems and schema
upgrades separate. Neither the checker nor startup performs automatic database repair.
