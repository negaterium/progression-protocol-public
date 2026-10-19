# Changelog

All notable public releases of Progression Protocol are recorded here.

## [Unreleased]

- Shorter S/S+/XX boss rotations, smoother Phase 3/4 combat, and an earned
  participation/victory XP allowance for rematches to preserve progression pace.
- Proportional repeat gold/loot rewards, full first-clear rewards, and legacy
  rules for encounters already in progress.
- Consistent effective combat HP, UTC cooldown displays, and bounty-aware
  backups/restores with atomic, duplicate-safe reward transactions.
- Numbered boss-balance migration 004, a guarded legacy upgrade path, offline
  simulation tools, and disposable PostgreSQL concurrency/rollback tests.

Apply migration 004 after a verified backup and before deploying this version.
See [boss balance and rollout](docs/BOSS_BALANCE.md).

## [0.1.0] - 2026-10-13

This is the first public source snapshot of Progression Protocol, an unofficial,
non-commercial, fan-made productivity RPG dashboard.

### Included

- Next.js 16 application with PostgreSQL-backed session authentication.
- Reviewed PostgreSQL baseline, catalog seed data and numbered catalog migrations.
- Quest, habit, skill, boss, inventory, store and shadow-army gameplay systems.
- Node.js 22 setup checks, Docker deployment support and separate PostgreSQL
  deployment guidance.
- Owner-generated visual assets, project screenshots and licensing/provenance
  documentation.
- Community contribution, security-reporting and support documentation.

### Release notes

- The public repository is a clean source snapshot without the private
  preparation repository's inherited Git history.
- The application remains an unofficial fan project and makes no claim of
  affiliation with or permission from third-party rights holders.
- Original owner-controlled code is licensed under MIT. Retained generated
  visual assets have the separate scope described in `docs/ASSET_LICENSE.md`.
