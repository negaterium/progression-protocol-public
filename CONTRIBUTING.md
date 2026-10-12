# Contributing

Contributions are welcome. Use issues for reproducible bugs and feature proposals.
Discuss changes to game balance, authentication, deployment or schema ownership
before implementing them. Maintainers use the [public release checklist](docs/RELEASE_CHECKLIST.md)
when preparing a distributable release.

This is an unofficial, non-commercial fan project. Read the
[fan-project notice](docs/FAN_PROJECT_NOTICE.md) before proposing catalog,
artwork or branding changes. Do not imply affiliation with any referenced
franchise or rights holder.

## Development setup

Follow [SETUP](docs/SETUP.md) with Node.js 22 and your own separately managed
PostgreSQL 17 database. Create a synthetic player with `db:create-user`; public
self-service registration is not implemented. Never use a production database for
tests. Existing deployments must not run the fresh initializer as an upgrade.

Start a descriptive branch, keep changes focused, and explain the user-visible
behavior and validation in your PR. Read [AGENTS.md](AGENTS.md) for project boundaries.
Keep server input validated and SQL parameters bound. Do not change the shared
connection pool, add dependencies without maintainer agreement, or include secrets.

## Checks

```sh
npm ci
npm test
npm run typecheck
npm run typecheck:scripts
npm run lint:tools
npm run assets:verify
npm run package:check
npm run audit:production
```

`assets:verify` checks the recorded asset bytes, not their ownership or licensing.
`package:check` verifies database hashes, private-file exclusions and packaging
metadata. It complements the release checklist; maintainers still review the
exact public snapshot and release refs before publishing.

For database changes run `npm run db:verify` with Docker. Authentication or runtime
changes additionally need `npm run security:verify`; deployment changes need
`npm run deployment:verify -- --use-build-cache`. These workflows use disposable
resources and exclude real configuration. Use the concealed password prompt;
never put a password in arguments or logs.

The CI workflow runs tests, app/script type checks, tooling lint, packaging checks,
HTTP boundary verification and disposable PostgreSQL integration. Production
dependency advisories at high/critical severity fail CI. Repository-wide
`npm run lint` has pre-existing failures and is not represented as passing by this
tooling check. Do not add new lint failures in changed application files; include
targeted checks in the PR when relevant. CI performs no deployment and receives
no production credentials.

## Schema, gameplay and assets

Do not edit an applied baseline. New schema changes require reviewed numbered
migrations and a tested upgrade/rollback plan. Keep catalog seeds free of player
records, private quests, accounts, sessions and logs. Include regression tests for
meaningful game rules; document intentional changes to XP, rewards or balance.

Provide provenance, permission/license evidence and attribution for new assets;
see [asset review](docs/ASSET_REVIEW.md). Generated assets must record the model,
reference-image status and selected asset license; the current retained outputs are
documented under [CC0](docs/ASSET_LICENSE.md). Do not assume code licensing covers
artwork or character material. Use synthetic data in screenshots. Contributors
must have the right to submit their original code under the project's MIT license;
no CLA or copyright transfer is requested.

## Communication

Be respectful, describe reproducible behavior, and give constructive review feedback.
Do not share private player data, raw environment files, database archives or
credentials in issues/PRs. Report vulnerabilities through the process in
[SECURITY.md](SECURITY.md).
