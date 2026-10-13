# Production deployment and operations

Keep PostgreSQL **separately managed**. The primary production topology is one
Node.js app container, a reverse proxy on the same Linux host, and PostgreSQL 17
on a trusted private network or secured tunnel. The protected database pool has
no configurable remote TLS options. Do not expose PostgreSQL to the public Internet.

Use [SETUP](docs/SETUP.md) for settings and fresh installation and
[the database package](database/README.md) for schema ownership and exports.
The existing `docker-compose.yml` remains the legacy direct-port deployment.
`compose.production.yml` is an **opt-in standalone file**, not an override: it
publishes only on host loopback. Changing to it requires an intentional cutover;
do not start both projects on port 9999. No production database or proxy is
created by either Compose file.

## 1. Prepare a release and its configuration

Requirements: Linux host, Git, Docker Engine 28 or later with Compose v2 supporting `up --wait`,
Node.js 22.20 or a newer 22.x patch for the source administration commands,
PostgreSQL 17, and a hostname/proxy for HTTPS. Builds need network access for npm,
base images and Google fonts. Use one app replica: login throttling is in memory,
and multi-instance caching/action-key coordination is not configured.
Keep Docker's default NAT bridge isolation; do not enable direct routing to the
app network. Docker releases before 28 have a documented LAN-access issue for
localhost-published ports; see [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/).

Clone an explicitly chosen release tag/commit into a fresh directory:

```sh
git clone https://github.com/negaterium/progression-protocol-public.git progression-protocol
cd progression-protocol
git checkout <reviewed-release-tag-or-commit>
npm ci
```

For a **new deployment only**, create a private configuration copy without
clobbering a file that already exists:

```sh
umask 077
test ! -e .env && cp .env.docker.example .env
chmod 600 .env
```

Edit the copy through your editor/secret manager. Use a dedicated non-superuser
app role that owns the new database/schema objects. Set `USE_SECURE_COOKIES=true`;
leave developer access empty. The app container must reach `POSTGRES_HOST`;
`localhost` inside it means the container itself. A private DNS name/IP on a
separate machine works when routing and PostgreSQL access rules permit it.
For host-local PostgreSQL, arrange a host-gateway/private interface route and
allow only that app network; a loopback-only PostgreSQL listener cannot be reached
from a normal bridge container. Do not solve this by exposing port 5432 publicly.

Check configuration, then initialize **only a new empty database** and create a player:

```sh
npm run config:check -- --env-file .env --mode production
npm run db:init -- --env-file .env --target-database progression_protocol --confirm
npm run db:create-user -- hunter --env-file .env --target-database progression_protocol
npm run config:doctor -- --env-file .env --mode production
```

Replace the target name with the exact configured database name. Existing
deployments skip initialization and account creation. Existing deployments may
continue using the legacy `solo_leveling_system` database name; do not rename a
live database solely for branding. Administration commands
require the source checkout's development dependencies; the runtime image omits them.

### Compose versus Next.js file parsing

Compose substitutes `${...}` from its process environment and selected `--env-file`;
these values become the container environment. Next.js/administration CLI file
parsing is a different loader. For simple values the same template works with both.
For literal dollar signs, Compose uses single-quoted values without expansion,
while Next's file loader requires `\$`. Do **not** assume one escaped password file
is portable between loaders. Prefer injecting literal `POSTGRES_*` settings through
your secret manager into both commands, omitting the CLI `--env-file`. Never put
passwords in command arguments. Process settings override selected file values;
use a clean operator shell so stale exports cannot select the wrong database.
See [Compose interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).
Avoid printing `docker compose config` or `docker inspect`: expanded output can
contain credentials. `config --quiet` validates without displaying them.

Compose reads and interpolates the full service definition before executing a
command, including `docker compose build`. If the private `.env` file is not
present, Compose will report a missing `POSTGRES_HOST` or another required
setting before the build starts. Create `.env` from `.env.docker.example`, edit
it privately, and pass `--env-file .env` to every Compose command. For a build
that does not require runtime configuration, use `docker build` directly.

## 2. Build first, then launch the app

Choose an immutable release label, replacing the example throughout:

```sh
docker build --tag progression-protocol:release-001 .
export SLS_APP_IMAGE=progression-protocol:release-001
docker compose --project-name progression-protocol --env-file .env -f compose.production.yml config --quiet
docker compose --project-name progression-protocol --env-file .env -f compose.production.yml up -d --wait --wait-timeout 120
```

Keep the exact source commit, image ID/digest and selected configuration path in
private operator records. Do not reuse a release tag for different builds. Local
image tags must exist on the deployment host; a private registry digest can be
used instead. Do not publish an image until publication reviews are complete.
`SLS_APP_PORT` optionally changes the host port; it defaults to 9999. Update the
proxy upstream if you change it. This file uses no fixed container name.

The `/login` health check detects process/HTTP availability, **not database health**.
After launch, run the doctor from the source checkout and sign in through HTTPS.
Open dashboard, profile, quests, inventory/store and skills. Complete a disposable
player's quest, reload to confirm XP, buy/use a consumable, and verify logout.
Use a dedicated test player; do not alter a real player's progress for routine checks.

If migrating from the legacy direct-port Compose deployment, build and configure
the proxy first, schedule a short maintenance window, stop the old app using its
existing project/configuration, and launch the new one against the same database.
Retain the old image and configuration for rollback. Never run fresh initialization
as part of that cutover.

## 3. HTTPS and trusted proxy configuration

Install/manage **one** proxy through your host's normal administration process.
Examples assume a proxy on the host, outside Docker. A containerized proxy needs
an explicit shared private network and service upstream instead of host loopback.
Do not publish the application publicly while trusting client-supplied headers.

### Caddy

Copy [Caddyfile.example](deployment/Caddyfile.example) to your Caddy service's
configuration, replace `system.example.com` with your domain, validate and reload:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Point public DNS A/AAAA records to the server, allow inbound TCP 80/443 to Caddy,
and preserve its writable certificate data directory. Public certificate issuance
and renewal need outbound access. Caddy provisions HTTPS and redirects HTTP as
explained in [its HTTPS documentation](https://caddyserver.com/docs/automatic-https).
For private names use your organization's trusted certificate workflow; browsers
must trust the issuing CA. Do not bypass certificate warnings.

The example overwrites `X-Real-IP` with the connecting client's address. Only after
the app can be reached exclusively through this proxy may you set
`SLS_TRUST_PROXY_HEADERS=true` and recreate the app with `up -d --wait`.
Keep this false when the app has other ingress paths. When another CDN/proxy sits
in front of Caddy, this example sees that proxy's address; configure explicit
trusted upstream handling before relying on per-client throttling.

### Nginx alternative

[nginx.conf.example](deployment/nginx.conf.example) shows host proxying, HTTP
redirect, certificate paths, overwritten forwarding headers and disabled response
buffering for Next.js streaming. Obtain certificates and configure automated renewal
through your existing ACME client before enabling the TLS server block, including
a successful-renewal hook that validates and reloads Nginx. Replace the
hostname/certificate paths, install it according to your distribution, then:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Keep the forwarded `Host` equal to the browser's public host so Server Actions'
origin validation works. Do not disable origin checks to fix an incorrect proxy.
The streaming guidance follows [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
For either proxy, keep `USE_SECURE_COOKIES=true` on HTTPS. A trusted private HTTP-only
deployment may explicitly use false, but that is a separate configuration decision.

## 4. Running from source on Linux

Follow the same database workflow and proxy topology. Install Node.js 22 using
your distribution/runtime manager, run `npm ci`, copy `.env.example` to a **new**
`.env.local`, and set production cookie/proxy values. Restrict configuration access
to the service account. Do not mix competing `.env*` files or systemd-injected
credentials without checking [Next's precedence](docs/SETUP.md#which-settings-are-loaded).

```sh
npm run config:check -- --env-file .env.local --mode production
npm run config:doctor -- --env-file .env.local --mode production
npm run build
npm run start -- --hostname 127.0.0.1
```

For persistent service management, adapt
[progression-protocol.service.example](deployment/progression-protocol.service.example). It assumes
a dedicated existing `sls` Unix account, an installed `/usr/bin/npm`, and the current
release at `/srv/progression-protocol/current`. Adjust paths to the actual Node installation.
The service account needs read access to source/configuration/dependencies and
write access to Next's `.next` cache; do not make the configuration world-readable.
Next loads `.env.local` itself; systemd's `EnvironmentFile` syntax is not equivalent.
Build as the service account or give it ownership of required runtime files.

After installing the adapted unit in `/etc/systemd/system/progression-protocol.service`:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now progression-protocol
sudo systemctl status progression-protocol
```

Use the same proxy examples. This template is for systemd Linux hosts; it is not a
Windows service or a PM2 configuration. Stop the app before changing an active
source release; never overwrite its `.next` directory while it serves requests.

## 5. Updates and rollback

1. Read the chosen release's compatibility/migration notes. Record the current
   source commit, app image and database version. Build the new image in a clean
   checkout **before** stopping the old app.
2. Take a full database backup and rehearse restoration below. Confirm the old
   image is retained locally or in your registry.
3. For an app-only, schema-compatible update, select the new `SLS_APP_IMAGE` and
   run the same `compose ... up -d --wait --wait-timeout 120` command. Compose
   replaces the app; a brief interruption is expected. It does not migrate PostgreSQL.
4. Run the read-only doctor and HTTPS smoke checks. Retain the previous image until
   the new release is accepted. `up --wait` reporting failure is **not** automatic rollback.

For an app-only rollback, set `SLS_APP_IMAGE` to the retained previous tag/digest and
repeat `up -d --wait`. Preserve the same project name, file and configuration path.
Do not prune old images until their recovery window ends.

The current package has a fresh-install baseline and an explicit checksum-checked
upgrade runner. Never edit an applied baseline, run `db:init` on a legacy deployment,
or use historical ad hoc migration scripts as release automation. When a release
contains numbered SQL migrations, inspect them first and apply them only after a
backup and rehearsal:

```sh
npm run db:migrate -- --target-database YOUR_DATABASE --env-file .env.local --check
npm run db:migrate -- --target-database YOUR_DATABASE --env-file .env.local --confirm
```

The runner refuses databases without the installed baseline marker, changed
applied files, missing migration files and out-of-order history. Each future
schema change still needs a compatibility plan and its own rehearsal. If the old
app cannot use the migrated schema, image rollback alone is insufficient: restore
a verified pre-update backup into another database and cut over intentionally.
Writes made after that backup will not be present. Stop writes before a recovery
cutover and agree on how to preserve/reconcile newer data.

For source deployment, build a new release directory separately, provision its
private configuration, then stop the service, point `current` to that directory
and restart. Roll back by selecting the retained compatible directory and restarting.
Do not copy `.env.local` into public artifacts.

## 6. Full PostgreSQL backups and recovery

`db:export` produces a **community schema/catalog package**, not a disaster-recovery
backup. In-app player snapshots also do not back up all accounts or server settings.
Full database archives contain private accounts, password hashes, sessions and
player data. Store them outside the repository, encrypted with restricted access,
with off-host copies. Never attach them to issues or release assets.

Use PostgreSQL 17 clients for the verified PostgreSQL 17 server. Avoid schema changes
during backup; a custom-format dump captures a consistent database snapshot. Cluster
roles, tablespaces, PostgreSQL configuration, private app settings, certificates
and external assets need separate secure backup. Have your administrator retain
these and arrange the required role/extension environment on recovery.
See [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).

These commands run on an administrator host that reaches PostgreSQL. Have your
secret manager/administrator populate a restricted `PGPASSFILE` (Unix mode 0600),
using PostgreSQL password-file escaping for colons and backslashes. Do not place
its contents in shell history. Set these non-secret selectors to the real source:

```sh
export PGHOST=db.example.internal
export PGPORT=5432
export PGUSER=sls_app
export PGDATABASE=progression_protocol
export PGPASSFILE=/secure/path/postgres.pgpass
# Run the backup script with failure propagation enabled.
set -eu
umask 077
backup_dir=$(mktemp -d /secure/backups/progression-protocol-XXXXXXXX)
pg_dump --format=custom --no-owner --no-acl --no-password --file="$backup_dir/database.dump"
pg_restore --list "$backup_dir/database.dump" > "$backup_dir/archive-list.txt"
(
  cd "$backup_dir"
  sha256sum database.dump > database.dump.sha256
)
```

Create `/secure/backups` first with restricted permissions. Check **each exit status**;
do not proceed after a failed dump. A checksum and archive listing detect some file
problems but do not prove recovery. Preserve warnings privately for review; avoid
sharing raw connection/row diagnostics. Treat the archive directory as incomplete
until the dump, listing and checksum succeed; schedule this workflow through your
normal backup system, alert on failure, and set retention to your recovery objectives.
Daily backups can lose up to a day's writes; tighter objectives need a PostgreSQL
administrator's continuous WAL/PITR plan, outside this logical-backup workflow.

For a restore rehearsal, have the administrator create a **different empty database**
(e.g. `progression_protocol_recovery`) owned by the recovery role. Do not run `db:init` there.
Ensure your password file matches the new target. After checking the checksum:

```sh
(
  cd "$backup_dir"
  sha256sum --check database.dump.sha256
)
PGDATABASE=progression_protocol_recovery pg_restore --dbname=progression_protocol_recovery \
  --no-owner --no-acl --no-password --single-transaction --exit-on-error \
  "$backup_dir/database.dump"
```

The target-name example is explicit: replace it with the verified **empty recovery**
database, never the live source. Do not add `--clean` or `--create`. Restoration is
atomic with `--single-transaction`; it fails on conflicts instead of replacing
existing tables. Restore only trusted archives; they contain executable database
object definitions. Restored objects belong to the restoring role, and grants are
omitted: the administrator must apply the intended ownership/permissions if the
app role differs. See [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

Configure a separate app/port/private network against the recovery database, with
only synthetic or explicitly authorized access. Use `config:doctor`, verify schema
and representative counts, then test known login, quests, inventory and saved
progress against that copy. Dumps preserve sessions; invalidate restored sessions
through a reviewed administrator procedure before opening a recovered service to
users if the incident requires it. Keep the source app/database intact during rehearsal.

For actual recovery, stop writes, retain the original database, update the private
app configuration to the verified recovery database, and recreate/restart the app.
Verify HTTPS/login and progress before reopening traffic. Reverting the database
selector can return to the old database only if its state remains usable; consider
writes on both sides before switching back. No destructive cleanup is part of this guide.

## 7. Monitoring and troubleshooting

```sh
docker compose --project-name progression-protocol --env-file .env -f compose.production.yml ps
docker compose --project-name progression-protocol --env-file .env -f compose.production.yml logs --tail 100 app
# Source deployment:
sudo journalctl -u progression-protocol -n 100 --no-pager
```

Keep logs private; runtime database diagnostics may include host/object details.
Monitor app health, database reachability, disk capacity, certificate expiry/renewal
and backup success/restore drills separately. Docker marks an unhealthy container;
its restart policy handles process exits, not automatic restarts merely for unhealthy status.

| Symptom | Check |
| --- | --- |
| Container exits before listening | Named configuration errors; placeholders, booleans, ports, UUIDs. |
| App healthy but pages fail | Run doctor; check DB route/access rules, schema and privileges. Login health is HTTP only. |
| Repeated login redirect | HTTPS and cookie policy; browser cookie domain/path; session validity. |
| Server Actions fail behind proxy | Public Host/Origin consistency; proxy streaming; selected image/config. |
| Proxy returns 502 | App status, loopback port, upstream address and proxy placement. |
| Port already in use | Existing app/project still owns 9999; perform a planned cutover or select another test port. |
| Per-IP login limiting groups all users | Proxy trust false, proxy not overwriting X-Real-IP, or extra CDN hop. |
| Missing table/migration error | Stop update; restore rehearsal/compatible release, never fresh-init the live database. |
| Restore permission/object conflict | Verify empty target, recovery ownership, extension requirements; keep source intact. |

A post-phase-3 smoke found successful logout logs a `NEXT_REDIRECT` console error;
access was cleared correctly. That known UI diagnostic is not proof that logout failed.

## 8. Rehearsal and limits of verification

```sh
npm run deployment:verify -- --use-build-cache
```

The verifier uses a clean source copy, its own PostgreSQL 17 container, synthetic
player, app image and loopback ports. It checks production Compose configuration,
app health, backup/archive restoration to a second empty database, preserved data,
and authenticated routes after a recovery switch and return to the source copy.
It never loads your real environment files, contacts the deployment database,
changes port 9999, or drops tables. Only its containers/network/image tags are
removed afterward; ignored source copies, synthetic archives and logs remain in scratch.
Omit `--use-build-cache` for a cold lockfile/dependency build.

Proxy configuration syntax is checked in disposable official proxy images. Public
DNS/ACME issuance, real certificate renewal, host firewall rules, Linux systemd
service installation, future migrations and disaster incident cutover still need
operator verification on their actual infrastructure. No real deployment or
publication occurs as part of this rehearsal.
The rehearsal injects a synthetic PostgreSQL credential into client processes;
the operator's password-file provisioning and file permissions require their own check.
