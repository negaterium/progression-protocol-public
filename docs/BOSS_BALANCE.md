# Boss rotation and earned XP

Bosses can be fought more frequently while repeat boss XP stays within a shared
earned allowance. First victories retain their full rank rewards. Cosmic fights
are unchanged. These rules start with encounters created by this app version;
active encounters from an older version finish with their original combat and
reward rules.

## Rotation and combat

| Rank | Repeat cooldown | Repeat gold/loot/shadow factor |
|---|---:|---:|
| S | 3 calendar days | 3/7 |
| S+ | 7 calendar days | 1/2 |
| XX | 14 calendar days | 14/30 |
| Cosmic | 60 calendar days | 1 |

Other rank timers are unchanged. All gate resets use **00:00 UTC**, counting
from the calendar day the encounter started, preserving the original timer
origin. Browser and server share the same calculation. Completion timestamps
record actual finishes and reward claims separately.

New Phase 3/4 S/S+/XX encounters use a smooth outgoing damage curve before the
old cap. The level-gap bonus contributes 20% of its previous amount, direct
damage has a 1.25 multiplier, and direct plus army damage has continuous
diminishing returns by quest rank. Stronger builds and harder quests still
shorten fights. Victory checks, retaliation and Life Drain use the resolved
damage, so a capped attack cannot suppress retaliation by incorrectly appearing
to kill the boss. Lower phases and Cosmic keep their existing combat formulas.

Quest status damage, combat retaliation and healing now use the same effective
maximum HP as the dashboard. They no longer clamp equipment-enhanced health to
the old `100 + raw vitality * 10` limit. The existing one-HP direct-hit floor
remains; fatal status damage still rejects and rolls back the action.

## Repeat boss XP

Only Phase 3/4 S/S+/XX **rematches** earn allowance credit. A player's daily base
allowance is 70% of the previous theoretical XP/day from their level-eligible,
previously defeated roster in those phases. It uses canonical rank rewards,
level scaling and post-cap scaling, with no account-specific constants.

Four E-rank quest equivalents completed during eligible combat earn one daily
allowance. Harder quest ranks contribute more. Time alone grants no XP. Up to
two days of unused earning opportunity carry over for clustered activity.

Half of earned base XP is awarded with the quest, and half enters a victory
bank. An eligible rematch victory releases that bank in place of ordinary repeat
kill XP; it does not pay both systems. The bank holds up to two daily allowances.
Previously earned bank credit is preserved if the current allowance decreases.
First-clear encounters keep full rewards and do not also earn the repeat fund.
Repeat fights outside the eligible phases retain rank-based XP with the same
proportional repeat factor as gold. Keys continue to follow existing return
probabilities, so guaranteed S-and-above key returns remain usable.

Credit is stored in integer millionths of base XP. Participation fractions carry
forward, and bonuses are applied once through the canonical XP award function
when credit is paid. The UI shows **base** XP so it does not promise an unknown
future temporary bonus on a banked payout.

## Integrity, saves and migration

The existing per-player transaction lock serializes quest completions and reward
claims. Participation events have unique user/completion keys; victory events
have unique user/encounter keys. The ledger, event, quest state, combat HP and XP
award commit together. A failure in a new encounter's reward path rolls back the
quest rather than silently consuming the quest without paying combat credit.

The migration adds `balance_version`, `is_first_clear`, `completed_at` and
`rewarded_at` to encounters. Version 1 records retain legacy rewards; new records
snapshot version 2 and first-clear eligibility under the player lock. Already
defeated encounters cannot be claimed again. Migration does not refill ledgers,
reset history, heal players, grant keys or award XP.

Backups and exports include bounty state/events and take a consistent snapshot
under the player lock. Restores include their safety backup in the transaction,
validate ownership/references, and restore idempotency keys with new event IDs.
Older saves without the new encounter columns restore as version 1; older saves
without bounty fields have no bounty state to restore. A full developer reset
clears the bounty ledger and events along with other progress.

Apply reviewed migration `004_boss_bounty_balance.sql` after a verified database
backup and before deploying this app version. Fresh installs also run numbered
migrations after the baseline. See [database operations](../database/README.md).
The app never migrates the database itself.
Legacy databases without the packaged baseline marker use the explicit
`--legacy-boss-balance` preflight/apply path documented in database operations.
It records only the boss feature checksum and never installs a fake baseline.

## Verification

```sh
npm test
npm run typecheck
npm run typecheck:scripts
npm run lint:tools
npm run db:verify
npm run simulate:bosses:extended -- --synthetic --seeds 24
```

`db:verify` requires Docker and creates only isolated disposable PostgreSQL
databases with generated credentials. It includes real concurrency, rollback,
legacy encounter, first-clear, effective HP, and save compatibility tests. The
database-specific test file is skipped by normal offline `npm test` unless a
dedicated loopback test database is explicitly selected by the verifier.

The extended simulator shares the production damage resolver and checks the
integer-credit ledger against the calibrated budget model. It still freezes
level/equipment and approximates active skills, recovery polling and bonus
timing. A simulated match to historical pacing is a calibration result, not a
guarantee that every player's future leveling speed is identical.
