# Gameplay integrity pass

This change keeps the current progression curve, reward amounts, rank thresholds,
boss scaling ceilings, delegation costs/durations and normal UI response shapes.
It requires no database migration or new dependency.

## Action boundaries

- Public quest completion derives rewards from the quest definition. Client XP is
  accepted for compatibility, but cannot set the award or bypass mana spending.
- Quest completion, acceptance, failure and Void Strike require the caller's quest
  or a global template. Completed/closed quests cannot be reaccepted for replay.
- The existing daily/weekly/monthly/yearly reset logic remains the mechanism for
  reopening recurring quests. Reset and completion share the same player lock.
- Delegation keeps immediate completion, mana exemption, infantry reservation and
  Beru's bonus. Reservation and completion commit together.
- Boss entry retains normal key consumption, inventory-key entry, Igris's exemption
  and the post-cap exemption. Inventory entry consumes exactly one key.
- Boss rewards require a zero-HP active encounter belonging to the caller. Only a
  successful reward transaction marks it defeated. Boss XP still runs while the
  encounter is active, preserving combat level-up healing.
- XP/gold injection, global boss console controls, explicit quest/system resets,
  manual extraction and the level-999 jump require a user ID explicitly authorized
  through server-only `SLS_DEVELOPER_USER_IDS`. Usernames and profile emails grant
  no privileges. Normal reward paths use internal server functions.
- Personal reset and ordinary boss defeat no longer change shared boss definitions;
  user unlocks continue to come from the player's encounter history.

## Transactions

`src/lib/server/game-db.ts` reuses the original pool without changing `db.ts`.
An async request scope routes nested reward/stat/audit/loot queries through one
client, and a profile row lock serializes the covered mutations for one player.
Different requests receive separate scopes. The adapter queues statements and
uses savepoints so existing optional SQL errors cannot abort a valid completion.
An optional combat failure rolls back that combat round and returns the existing
`bossError` field, while the quest can still complete.

Quest status, XP, mana, gold and the daily bounty receipt commit together. A required
failure rolls them back. Achievement rewards are gated by a successful unique
achievement insert. Existing optional loot/log behavior is preserved.

Savepoints add database statements; request latency on the deployed PostgreSQL
connection has not been measured. Other mutations outside these covered flows
have not received a complete concurrency or authorization audit.

## Progression and combat

The compatibility XP helpers delegate to `leveling.ts`. Dashboard progress and
prestige resets now use the same thresholds as actual XP awards; existing levels
and balances are not migrated. Hunter display ranks and item/key entry thresholds
keep their distinct existing values. Identical boss scaling caps are shared.
Combat sums overlapping equipment attributes and clamps final crit probability to
0–100% without changing in-range probabilities.

## Validation and rollout

Run `npm test` and `npm run typecheck`. The suite covers normal completion, ownership,
global templates, duplicate/concurrent requests, required rollback, optional audit
failure, recurring reset, failure penalties, delegation, keys, boss rewards/victory,
developer controls, level-up rewards, achievement claims, progression and equipment.

Action/transaction tests use an in-memory database double. They do not verify
PostgreSQL itself, production latency, or browser behavior with live player data.
The production compile check uses an isolated copy under `scratch/integrity-build`
without environment files. Google fonts are stubbed only in that disposable copy
to keep the compilation offline; actual font loading is not checked.

Verification for this pass: 84 tests passed; TypeScript and ESLint passed; the
isolated Next.js production compile passed. A temporary server from that build
served the login form (200), redirected an unauthenticated dashboard request to
login (307), and rejected an unauthenticated `/api/auth/me` request (401). The
temporary server was stopped after these checks.

Before deployment, use a disposable/staging database and a test account to exercise
completion/retry, a recurring reset, delegation, inventory key entry, boss victory,
combat level-up healing and prestige. Check the resulting balances and encounter
state, and record latency. No deployment or live database changes are part of this
pass.
