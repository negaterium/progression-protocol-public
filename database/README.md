# Database package: separate PostgreSQL

Keep PostgreSQL separately managed. Docker Compose runs only the app on port
9999. The packaged baseline requires PostgreSQL 17 or later; PostgreSQL 17 is
the version verified here. Later major versions have not been tested.
Use [Setup and Configuration](../docs/SETUP.md) for the canonical first-install
workflow, environment templates, defaults and troubleshooting.

## Fresh installation

Provision an **empty dedicated database** and a login role that owns it through
your database administrator. Use a role with schema creation and normal app
permissions, rather than a PostgreSQL superuser. Networking and database backups
remain the administrator's responsibility. The current connection pool supports
the existing private-network deployment; remote TLS connection options are not
implemented. Use a trusted private network or secured tunnel.

Run commands from the repository root after `npm ci`. Supply `POSTGRES_HOST`,
`POSTGRES_PORT`, `POSTGRES_DATABASE`, `POSTGRES_USER` and `POSTGRES_PASSWORD`
through the process environment. Alternatively explicitly select a local file
with `--env-file .env.local`. These tools never automatically load an environment
file and never print credentials or connection settings.
`npm run config:check -- --env-file .env.local` validates these settings offline;
after installation, `npm run config:doctor -- --env-file .env.local` checks
database reachability, version and app-table permissions using read-only queries.

```sh
npm run db:init -- --target-database YOUR_EMPTY_DATABASE --confirm --env-file .env.local
npm run db:create-user -- hunter --target-database YOUR_EMPTY_DATABASE --env-file .env.local
```

The account command prompts without echoing the password. Credentials, a
level-one profile, hunter stats and states for shared quests are created in one
transaction. Existing usernames are rejected, never reset or linked to another
profile. Passwords need at least eight characters and at most 72 UTF-8 bytes;
never put them in command arguments.

Launch the app using your normal deployment. A player starts with zero XP/gold,
attributes of 10, full HP/MP and the canonical next-level XP threshold. Developer
privileges require explicit `SLS_DEVELOPER_USER_IDS` configuration.

## Baseline and upgrades

`migrations/001_baseline.sql` contains tables, constraints, indexes, identity
sequences and the session cleanup function. `seeds/catalogs.json` contains only
shared zones, items, bosses, boss objectives, skills, achievements, titles and
quests with `user_id = null`. Stable catalog IDs preserve references. Accounts,
sessions, player data, private quests, activity logs and saves are excluded.
Catalog creation timestamps are normalized to a fixed date; source history
timestamps are not included. `manifest.json` records package hashes and counts.
The database SQL, catalog JSON and manifest use LF line endings enforced by
`.gitattributes`, so checksummed bytes stay identical in Windows and Linux checkouts.

`db:init` installs schema, catalogs and the `sls_schema_migrations` checksum record
in one transaction under a database advisory lock. Failures roll back. Rerunning
the exact baseline is a no-op, including after players begin using the app.
Modified baselines are rejected. Existing public tables, views or sequences
without the migration record cause initialization to stop.

**Keep using your existing database unchanged. Do not run `db:init` against it.**
This package supplies a fresh-install baseline, not an upgrade or adoption tool.
Nothing runs at app startup. Numbered, reviewed SQL upgrades belong in
`database/migrations/` and are applied explicitly with the migration runner:

```sh
npm run db:migrate -- --target-database YOUR_DATABASE --env-file .env.local --check
npm run db:migrate -- --target-database YOUR_DATABASE --env-file .env.local --confirm
```

The runner requires the installed baseline marker, checks PostgreSQL 17+, locks
the migration sequence, verifies checksums for applied files and applies pending
files atomically. It refuses gaps, changed applied files and databases without the
baseline marker. The package includes `002_skill_catalog_truth.sql`, which aligns
shared skill descriptions and display-only effects for databases created from an
earlier catalog snapshot, and `003_clear_missing_item_images.sql`, which removes
six stale image URLs from existing item rows after those seed references were
cleared. Fresh installs may apply both harmlessly; later releases add their own
numbered files.
Do not edit an applied baseline or use the historical ad hoc scripts as an
installer. Verify a database backup before upgrades.

### Skill catalog correction migration

The reviewed seed now describes the seven active modules using their real rank
formulas and identifies the implemented stat imprint for passive modules. A
database created before this correction keeps its previous text until the
numbered `002_skill_catalog_truth.sql` migration is applied. After taking a
backup, preview all pending reviewed upgrades with:

```sh
npm run db:migrate -- --target-database YOUR_DATABASE --env-file .env.local --check
```

Review the pending migration list, then apply it atomically with:

```sh
npm run db:migrate -- --target-database YOUR_DATABASE --env-file .env.local --confirm
```

The migration runner verifies the baseline marker and checksums, applies pending
SQL files under an advisory lock, and never runs during application startup. New
releases must add reviewed SQL to `database/migrations/`; historical one-off
TypeScript migration helpers are not part of the public installer.

The baseline contains SQL only, with transaction-local settings. It must be run
inside the initializer's transaction. It accepts an existing public schema and
schema-qualifies the cleanup function's session table. Database creation, roles,
ownership grants and live row data are not included.

## Read-only exports

```sh
npm run db:export -- --env-file .env.local --output scratch/database-export-new
```

Requires a compatible `pg_dump` on PATH, or `--pg-dump /path/to/pg_dump`.
An alternative uses a Docker client without starting a database:

```sh
npm run db:export -- --env-file .env.local --docker-image postgres:17 --output scratch/database-export-new
```

The client container must reach the external database; `localhost` inside that
container refers to itself. Credentials travel through process environment
variables, never command arguments or output. Tool errors are summarized without
raw connection diagnostics.

The exporter shares a repeatable-read snapshot between the schema dump and the
fixed catalog queries. Avoid schema migrations during export. PostgreSQL requires
a client that supports the source server version; `pg_dump` cannot dump a server
newer than its own major version.
[See PostgreSQL's schema-only and version documentation](https://www.postgresql.org/docs/17/app-pgdump.html).

Output goes only to a **new directory under ignored `scratch`**. Review the schema,
catalog text/JSON, asset paths, account references and private URLs before promoting
files. Functions/defaults may contain sensitive literals even in schema-only SQL.
Private quests are filtered out and unexpected personal-data columns are rejected.
The manifest records versions, counts and hashes without connection details.
The public-schema dump excludes dependencies in other schemas and extension
definitions; review those explicitly if the deployment changes.

## Integration checks

```sh
npm run db:verify
```

Requires Docker Engine and `postgres:17`, pulled on first use. It starts an
isolated temporary database with a generated credential and random loopback-only
port. It never loads environment files or contacts the configured deployment.
Checks cover existing-database rejection, failed-installation rollback,
installation, reruns, changed-baseline rejection, playable account
creation, bcrypt verification, duplicate rejection, real save restoration,
rollback and legacy saves. It stops/removes its container afterward and uses no
persistent volume. Redacted results remain in `scratch/database-verification`.

Browser gameplay is checked separately from the CLI integration checks. Full
private backups and recovery to another database are documented in the
[deployment guide](../DEPLOYMENT.md#6-full-postgresql-backups-and-recovery);
`npm run deployment:verify -- --use-build-cache` rehearses them with synthetic data.
Artwork/franchise redistribution rights remain a publication review gate.
