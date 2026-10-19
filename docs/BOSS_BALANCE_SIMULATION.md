# Offline boss balance simulation

This document describes the baseline experiment and its limitations. The chosen
policy is now implemented; see [current rules and rollout](BOSS_BALANCE.md).
References below to legacy gameplay describe the simulation's baseline, not the
new version's behavior. Private account snapshots and reports are not published.

The experiment compares more frequent encounters with approximately unchanged
progression at a fixed player level. It does not change gameplay, migrate the
database, load environment files, or connect to PostgreSQL. The runner rejects
database operations; the only permitted combat lookup is an in-memory shadow
assignment response.

Run the public synthetic example:

```powershell
npm run simulate:bosses -- --synthetic --out scratch/boss-balance-example --seeds 24
```

For the corrected pre-cap and HP/MP experiment:

```powershell
npm run simulate:bosses:extended -- --synthetic --seeds 24
npm run simulate:bosses:extended -- --snapshot scratch/boss-simulation-snapshot.json --seeds 24
```

The extended runner writes to ignored `scratch/boss-balance-extended/`. It
supersedes the first pass for balance decisions. Exclude `quest_type = 'BOSS'`
from exported quest events: those are reward log entries, not extra actions.

For an authorized, privately prepared snapshot:

```powershell
npm run simulate:bosses -- --snapshot scratch/boss-simulation-snapshot.json --seeds 24
```

Reports and per-seed results default to ignored `scratch/boss-balance/`. Keep
account-specific snapshots and reports there. The runner accepts only a local
JSON snapshot, never database credentials. No additional package is required.

## Model

- Use the unmodified production outgoing combat calculation, HP scaling, loot
  tables, reward constants, and cumulative leveling curve.
- Compare current timers, shorter timers with full rewards, shorter timers with
  proportional rewards, and proportional rewards with experimental outgoing
  damage attenuation and total-hit ceilings.
- Freeze level, equipment, skills, effective stats, and unlocked roster. This
  isolates battles at a similar level. Projected ending level is only a mapping
  of earned XP through the curve, not a simulation of future unlocks or growth.
- Replay 28 complete days of ordered quest events, including days with no quests.
  Measure after 56 warmup days and separately from the account's timer state.
- Start one encounter before each eligible quest when none is active. Prefer
  the highest phase, rotating fairly by oldest start time. This eager policy
  represents available farming potential, not actual human choices.
- Respect level and phase sequence. Retain current encounter-start-based
  cooldowns for a fair comparison; do not silently fix their origin.
- Keep the non-boss XP budget identical between policies. Use `XP_GAIN` audit
  totals minus boss XP once; do not add `QUEST_COMPLETE` XP a second time.
- Return expected loot units and shadow upgrade opportunities, as well as XP,
  gold, fight rounds, fight hours, idle quest share, and completed battles.
- Run reproducible seeded samples for the observed mix, effective-stat
  variations, available-army siege, alternate classes with the same gear, basic
  quest activity at two rates, and the current phase alone.

## Snapshot contract

The runner's `Snapshot` type in `scripts/simulation/boss-balance.ts` documents the
JSON shape. Include `capturedAt`, cumulative `startXp`, `level`, `traceDays: 28`,
observed boss XP/kills, non-boss XP, ordered `quests`, boss definitions/history,
and the production combat input without `activeEncounter`.
The optional `observedBossXpMultiplier` holds historical weighted boss-XP bonus
exposure constant across policies. It is an absolute multiplier, replacing the
current gear-only XP bonus; do not apply both and double-count bonuses.

Quest `at` values are milliseconds from the trace's starting midnight. Boss rows
need `defeated` and optionally `last_started_at`. Combat gear must use the same
raw effects as `quest-completion.ts`; `effectiveStats` must come from the server
stats calculation, which already handles quality, level scaling, and imprints.
Using raw stats instead of effective stats understates current damage.

When deriving observed non-boss XP, verify that `BOSS_DEFEAT.diff_xp` matches the
actual boss `XP_GAIN`. Temporary XP multipliers can make those differ; do not
subtract pre-bonus rewards from an actual awarded-XP total without reconciling
them. The synthetic fixture does not claim a historical baseline.

## Acceptance and limits

Compare two distinct reference points: actual historical progression and eager
farming with the player's current build. Matching one does not prove that the
other is unchanged. A candidate should reduce idle quest completions, increase
completed battles, and keep the chosen 28-day XP budget within about 5%.

The experiment intentionally does not simulate HP/MP depletion, boss abilities,
stuns, regeneration, active skill schedules, delegation eligibility, new gear,
new unlocks, achievement cascades, or lower-tier farming. Longer encounters
increase retaliation and need a separate survival pass. Loot units do not
measure item power. Synthetic activity holds other XP constant to isolate boss
effects; it does not predict a player's total income at that activity level.

Candidate attenuation and ceilings are applied after existing production damage
caps. This allows an initial comparison without touching live combat, but can
hide differences between strong builds. Before selecting final parameters,
evaluate damage before the existing cap and include representative class/gear
builds, recovery costs, slow activity, and higher-rank quests.

Current-state timer projections use approximate calendar buckets. All seeded
runs share a reproducible seed, but differing encounters consume random numbers
differently; they are not identical per-quest random-roll replays. The repeated
trace and fixed build mean seed spread captures combat randomness only, not
uncertainty in future behavior. No simulation result automatically approves a
live balance change.

Validation:

```powershell
npm test -- src/lib/simulation/boss-balance.test.ts src/lib/game-logic/boss-combat.test.ts src/lib/game-logic/boss-cooldowns.test.ts
npm run typecheck:scripts
```

## Extended replay and current candidate

The extended experiment calls the production combat function with an optional
outgoing-damage evaluator. It receives direct damage before the existing cap
and shadow damage separately. Candidate damage is resolved before Life Drain,
victory checks, and boss retaliation. Legacy gameplay callers supply no evaluator
and retain their formulas and caps. New eligible encounters use the shared
production resolver. Regression tests cover the default path,
pre-cap build differentiation, retaliation, and healing.

Resources include elapsed-time regeneration, quest mana cost/reward, delegated
mana exemptions and actual assignment size, purification, turn-based boss
statuses, stun, Life Drain, Mana Shield, evasion, and catalog boss abilities.
Unknown mana costs from deleted quest definitions are recorded and treated as
zero, so resource costs remain a lower bound. Potion sensitivity uses standard
catalog replacement prices rather than assuming free consumables.

The legacy action had two behaviors important to interpreting results: it used
`100 + raw vitality * 10` as the combat HP limit, and direct boss damage clamps
player HP to at least one. Fatal status damage blocks and rolls back the quest.
The simulator reproduces those behaviors, records lost health from the HP clamp
and hits protected by the one-HP floor, and separately tests using the effective
HP limit. Do not interpret direct-hit floor events as encounter deaths.

The smoother experimental curve reduces the level-gap contribution before
applying continuous diminishing returns to the combined direct and army damage.
The candidate takes 20% of the existing level-gap bonus, a 1.25x direct factor,
and soft ceilings by quest difficulty (E 18%, D 24%, C 32%, B 40%, A 55%, S 75%,
S+/XX 100%). The ceiling is an asymptote rather than a hard plateau. Stronger
builds retain a shorter fight duration. These values are not live settings.

An additional XP-budget policy addresses the slower-activity loss from replacing
two-round fights with longer encounters:

- Derive a daily XP allowance from 70% of the eligible Phase 3/4 roster's
  theoretical current reward rate at the same level. The historical weighted
  XP bonus is held constant across policies only for this experiment.
- Four E-rank quest equivalents in combat earn one allowance. Harder quests
  contribute more. Time alone never grants XP.
- Keep up to two days of unused earning opportunity for clustered activity.
- Pay half of earned boss XP on participation and bank half until victory.
  Cap the unclaimed payout bank at two daily allowances. Report banked XP
  separately; it is not counted as granted leveling XP.
- Remove ordinary repeat kill XP from this policy to avoid paying both systems.
  First clears retain full rewards and do not also earn the participation fund.
- Gold, expected loot, and shadow upgrade opportunities still use the shorter
  cooldown's proportional repeat factor. XP-budget stability does not establish
  equal item power or gold income across workloads.

This tests approximately unchanged observed leveling pace while allowing more
encounters for the reference workload. Five quests per day cannot produce more
12-action encounters than a system whose fights finish in two actions; the
budget protects its XP income rather than promising equal battle counts.

The implementation resolves the raw/effective HP inconsistency and includes
effective-HP transaction tests. The model still omits active skill
schedules, the daily full-restore bounty, evolving equipment, shop discounts,
inventory and gold affordability, and exact polling/bonus accounting. Non-boss
XP after blocked actions is estimated by historical quest-XP-weight proration.
Matching this account's history is not proof of population-wide balance.
