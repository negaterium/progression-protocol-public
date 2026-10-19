/** Offline only. No env-file loading and no database connections. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DAY_MS, seededRandom, simulateBossBalance, type BalancePolicy, type QuestEvent } from '../../src/lib/simulation/boss-balance';
import { LEGACY_BOSS_COOLDOWNS as BOSS_COOLDOWNS } from '../../src/lib/game-logic/boss-balance-policy';
import { calculateBossMaxHP, calculateGlobalRewardMultiplier } from '../../src/lib/system/formula';
import { calculateLevel } from '../../src/lib/system/leveling';
import { BOSS_LOOT_TABLE } from '../../src/lib/game-logic/boss-loot';
import { CLASS_MODIFIERS } from '../../src/lib/stats-manager';
import { syntheticSnapshot, type SimulationSnapshot as Snapshot } from './snapshot';
async function main() {
    const args = process.argv.slice(2);
    const argument = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
    const snapshotPath = argument('--snapshot', '');
    const out = resolve(argument('--out', 'scratch/boss-balance'));
    const seeds = Number(argument('--seeds', '12'));
    if ((!snapshotPath && !args.includes('--synthetic')) || !Number.isInteger(seeds) || seeds < 1 || seeds > 100) {
        throw new Error('Usage: npm run simulate:bosses -- (--snapshot PATH | --synthetic) [--out scratch/boss-balance] [--seeds 12]');
    }
    const snapshot: Snapshot = snapshotPath ? JSON.parse(readFileSync(resolve(snapshotPath), 'utf8')) : syntheticSnapshot();
    if (snapshot.traceDays !== 28 || !snapshot.quests.length || snapshot.nonBossXp < 0) throw new Error('Expected a nonempty 28-day snapshot with nonnegative non-boss XP');

    // Fail closed: any unexpected SQL from production helpers aborts the experiment.
    const { gameDb } = await import('../../src/lib/server/game-db');
    const { default: db } = await import('../../src/lib/db');
    const forbidden = async (): Promise<never> => { throw new Error('Database access is forbidden in the offline simulator'); };
    db.query = forbidden;
    db.queryOne = forbidden;
    db.getClient = forbidden;
    db.transaction = forbidden;
    gameDb.query = async () => { throw new Error('SQL is forbidden in the offline simulator'); };
    gameDb.transaction = async () => { throw new Error('Transactions are forbidden in the offline simulator'); };
    let assignedFraction = 0;
    gameDb.queryOne = async <T>(sql: string): Promise<T | null> => {
        if (!sql.includes('FROM shadow_assignments')) throw new Error('Unexpected SQL in combat sampler');
        return assignedFraction ? { shadow_count: Math.floor(snapshot.combat.shadowStorageLimit * assignedFraction) } as T : null;
    };
    const { calculateBossCombatRound } = await import('../../src/lib/game-logic/boss-combat');
    const { RANK_REWARDS } = await import('../../src/lib/server/boss-rewards');
    const baseline: BalancePolicy = { name: 'current', cooldowns: BOSS_COOLDOWNS, rewardScale: {}, damageScale: 1, totalDamageCaps: {} };
    const shorter = { ...BOSS_COOLDOWNS, S: 3, 'S+': 7, XX: 14 };
    const neutral = Object.fromEntries(Object.entries(shorter).map(([rank, days]) => [rank, days / BOSS_COOLDOWNS[rank]]));
    const policies: BalancePolicy[] = [
        baseline,
        { ...baseline, name: 'shorter-full-rewards', cooldowns: shorter },
        { ...baseline, name: 'shorter-proportional-rewards', cooldowns: shorter, rewardScale: neutral },
        { ...baseline, name: 'tuned-proportional-rewards', cooldowns: shorter, rewardScale: neutral, damageScale: 0.35,
            totalDamageCaps: { E: 0.09, D: 0.12, C: 0.16, B: 0.20, A: 0.25, S: 0.30, 'S+': 0.35, XX: 0.35 } },
    ];
    const variants = [
        { name: 'observed-mix', scale: 1, assignment: 0, daily: 0, minPhase: 3 },
        { name: 'weaker-stats', scale: 0.65, assignment: 0, daily: 0, minPhase: 3 },
        { name: 'stronger-stats', scale: 1.5, assignment: 0, daily: 0, minPhase: 3 },
        { name: 'available-army-siege', scale: 1, assignment: 1, daily: 0, minPhase: 3 },
        { name: 'fighter-same-gear', scale: 1, assignment: 0, daily: 0, minPhase: 3, hunterClass: 'Fighter' },
        { name: 'assassin-same-gear', scale: 1, assignment: 0, daily: 0, minPhase: 3, hunterClass: 'Assassin' },
        { name: 'five-E-per-day', scale: 1, assignment: 0, daily: 5, minPhase: 3 },
        { name: 'twenty-E-per-day', scale: 1, assignment: 0, daily: 20, minPhase: 3 },
        { name: 'phase4-only', scale: 1, assignment: 0, daily: 0, minPhase: 4 },
    ];
    const allResults: Record<string, unknown>[] = [];
    const summaries: Record<string, unknown>[] = [];
    const originalRandom = Math.random;
    try {
        for (const mode of ['steady', 'current-state'] as const) {
            for (const variant of variants) {
                const warmupDays = mode === 'steady' ? 56 : 0;
                const days = warmupDays + 28;
                const events: QuestEvent[] = variant.daily
                    ? Array.from({ length: days * variant.daily }, (_, i) => ({ at: Math.floor(i / variant.daily) * DAY_MS + (9 + (i % variant.daily) * 12 / variant.daily) * 3_600_000, difficulty: 'E', xp: 0 }))
                    : Array.from({ length: days / 28 }, (_, cycle) => snapshot.quests.map(q => ({ ...q, at: q.at + cycle * 28 * DAY_MS }))).flat();
                const bosses = snapshot.bosses.filter(b => b.phase >= variant.minPhase && b.phase <= 4);
                const rows: Record<string, number | string>[] = [];
                for (const policy of policies) {
                    for (let seed = 1; seed <= seeds; seed++) {
                        Math.random = seededRandom(seed);
                        assignedFraction = Math.min(variant.assignment, snapshot.combat.shadowInfantryCount / snapshot.combat.shadowStorageLimit);
                        // Current-state comparison keeps the old timer origin; only the candidate interval changes.
                        const capturedDay = Date.parse(snapshot.capturedAt.slice(0, 10));
                        const initialReadyAt = mode === 'current-state' ? Object.fromEntries(bosses.map(b => [b.id,
                            b.last_started_at ? Math.max(0, Date.parse(b.last_started_at.slice(0, 10)) + (policy.cooldowns[b.rank] ?? 1) * DAY_MS - capturedDay) : 0,
                        ])) : undefined;
                        const result = await simulateBossBalance({
                            bosses, events, days, warmupDays, level: snapshot.level, initialReadyAt,
                            hpForBoss: boss => calculateBossMaxHP(boss.rank, snapshot.level, boss.max_hp, snapshot.level >= 999),
                            rewardForBoss: boss => {
                                const base = RANK_REWARDS[boss.rank] || RANK_REWARDS.C;
                                const multiplier = calculateGlobalRewardMultiplier(snapshot.level);
                                const goldBonus = snapshot.combat.equipment.reduce((m, e) => m * (1 + (e.gold_bonus || 0)), 1);
                                const xpBonus = snapshot.combat.equipment.reduce((m, e) => {
                                    const mult = e.xp_multiplier ? m * e.xp_multiplier : m;
                                    return mult + ((e.xp_boost_int && e.intelligence) ? e.intelligence * e.xp_boost_int : 0);
                                }, 1);
                                // Hold observed boost exposure constant across policies; do not count it as quest XP.
                                const bossXpBonus = snapshot.observedBossXpMultiplier ?? xpBonus;
                                return { xp: Math.floor(Math.floor(base.xp * multiplier) * bossXpBonus), gold: Math.floor(base.gold * multiplier * goldBonus),
                                    loot: (BOSS_LOOT_TABLE[boss.name] || []).reduce((s, entry) => s + entry.chance * entry.quantity, 0) };
                            },
                            round: async ({ boss, hp, maxHp, difficulty }) => {
                                const hunterClass = variant.hunterClass ?? snapshot.combat.hunterClass;
                                const sourceClassStats = CLASS_MODIFIERS[snapshot.combat.hunterClass]?.stats || {};
                                const targetClassStats = CLASS_MODIFIERS[hunterClass]?.stats || {};
                                const result = await calculateBossCombatRound({
                                    ...snapshot.combat,
                                    hunterClass,
                                    effectiveStats: Object.fromEntries(Object.entries(snapshot.combat.effectiveStats || {}).map(([k, v]) => [k,
                                        v * variant.scale * (targetClassStats[k] || 1) / (sourceClassStats[k] || 1)])),
                                    questDifficulty: difficulty,
                                    activeEncounter: { id: 'simulation', boss_id: boss.id, boss_name: boss.name, boss_rank: boss.rank,
                                        current_hp: hp, max_hp: maxHp, intel: {}, damage_type: 'PHYSICAL' },
                                });
                                return { damage: result.damageDealt, incomingHpFraction: 0 };
                            },
                        }, policy);
                        const totalXp = result.bossXp + snapshot.nonBossXp;
                        allResults.push({ mode, variant: variant.name, seed, ...result, totalXp,
                            projectedLevel: calculateLevel(snapshot.startXp + totalXp).level });
                    }
                    const runs = allResults.filter(r => r.mode === mode && r.variant === variant.name && r.name === policy.name);
                    const average = (key: string) => runs.reduce((s, r) => s + Number(r[key]), 0) / runs.length;
                    rows.push({ policy: policy.name, kills: average('kills'), bossXp: average('bossXp'), totalXp: average('totalXp'),
                        gold: average('gold'), loot: average('expectedLootUnits'), shadow: average('expectedShadowUpgrades'),
                        idlePercent: average('idleQuests') / average('measuredQuests') * 100,
                        rounds: average('meanFightRounds'), hours: average('meanFightHours'), twoRoundKills: average('twoRoundKills'),
                        projectedLevel: average('projectedLevel') });
                }
                const base = Number(rows[0].totalXp);
                for (const row of rows) {
                    row.totalXpDeltaPercent = (Number(row.totalXp) / base - 1) * 100;
                    row.bossXpDeltaPercent = (Number(row.bossXp) / Number(rows[0].bossXp) - 1) * 100;
                    row.observedXpDeltaPercent = snapshot.observedBossKills ? (Number(row.totalXp) / (snapshot.nonBossXp + snapshot.observedBossXp) - 1) * 100 : 0;
                    summaries.push({ mode, variant: variant.name, ...row });
                }
                console.log(mode, variant.name, JSON.stringify(rows));
            }
        }
        mkdirSync(out, { recursive: true });
        writeFileSync(resolve(out, 'runs.json'), JSON.stringify({ metadata: {
            snapshotDate: snapshot.capturedAt, level: snapshot.level, seeds, observedQuests: snapshot.quests.length,
            observedBossKills: snapshot.observedBossKills, observedBossXp: snapshot.observedBossXp, nonBossXp: snapshot.nonBossXp,
            observedBossXpMultiplier: snapshot.observedBossXpMultiplier ?? null,
            assumptions: [
                'Fixed level, gear, skills and roster isolate same-level balance; projected level only maps XP through the real curve.',
                '56-day warmup then 28-day measurement, plus a separate 28-day current-state experiment.',
                'Observed quest timestamps repeat, including inactive days. Synthetic schedules keep the same non-boss XP to isolate combat supply.',
                'All eligible completed quests trigger combat; delegation/offline eligibility is not reconstructed.',
                'No deaths, resource shortages, ability statuses, regeneration or gear evolution: an optimistic combat availability model.',
                'No temporary skill activation schedule; effective stats are frozen from the snapshot. Incoming damage is not simulated.',
                'When provided, the observed average boss XP multiplier preserves historical boost exposure; payout timing is not replayed.',
                'Candidate attenuation and total-hit ceilings are applied after the unmodified production outgoing calculation.',
                'Loot and shadow figures are expected units/opportunities; no item power valuation or equipment feedback.',
                'First-clear bonuses are modeled but this experienced account already cleared its eligible roster.',
                'UTC day buckets approximate Bucharest dates; do not use current-state results as an exact live reset prediction.',
                'Cosmic, new unlocks, lower-tier farming, achievement cascades, and post-cap XP are outside this level-158 experiment.',
            ],
        }, policies, summaries, runs: allResults }, null, 2));
        const f = (value: unknown, digits = 1) => Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
        const report = [
            '# Boss balance experiment', '',
            `Fixed level: ${snapshot.level}. Measurement: 28 days. Seeds: ${seeds}. Historical quest events: ${snapshot.quests.length}.`, '',
            `Observed reference: ${snapshot.observedBossKills} boss defeats; ${f(snapshot.observedBossXp, 0)} boss XP; ${f(snapshot.nonBossXp, 0)} other XP.`, '',
            'The current-policy simulation is an eager, current-build farming baseline. The observed reference includes historical gear, cooldowns, and player choices. These are different comparisons.', '',
            '| Mode | Activity | Policy | Battles | Boss XP | Total XP | Change vs simulated current | Change vs observed | Idle quests | Quests/fight |',
            '|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
            ...summaries.map(r => `| ${r.mode} | ${r.variant} | ${r.policy} | ${f(r.kills)} | ${f(r.bossXp, 0)} | ${f(r.totalXp, 0)} | ${f(r.totalXpDeltaPercent)}% | ${snapshot.observedBossKills ? f(r.observedXpDeltaPercent) + '%' : 'n/a'} | ${f(r.idlePercent)}% | ${f(r.rounds)} |`), '',
            '## Interpretation limits', '',
            '- This is an outgoing-damage and availability experiment, not a full survival simulator. More rounds also mean more boss retaliation in the real game.',
            '- Fixed effective stats, raw combat gear, skills, and level use the current production formulas. Future unlocks and equipment feedback are excluded.',
            '- Weaker/stronger variants change effective stats only. Alternate classes reuse the same gear and skill modifiers with approximate class-stat conversion; these are sensitivity checks, not representative class builds.',
            '- No active ability schedule, stuns, resource constraints, offline eligibility reconstruction, or player choice model.',
            '- Historical boss XP boosts, when supplied, use one observed weighted average across policies; their precise activation timing is not replayed.',
            '- Candidate caps and attenuation run after current damage caps. Saturated hits conceal some equipment differences; do not ship these numbers without a pre-cap sensitivity and survival pass.',
            '- Expected loot units and shadow upgrade opportunities are recorded in runs.json; they are not a guarantee of equal item power.',
            '- Observed non-boss XP is held constant even for synthetic activity; their XP figures isolate boss effects, not a forecast of those lifestyles.',
            '- Current-state timers use approximate date buckets; they are not exact live cooldown predictions.',
            '- No candidate is automatically approved. Compare both historical pacing and current-build potential before choosing a budget.', '',
        ].join('\n');
        writeFileSync(resolve(out, 'report.md'), report);
        console.log(`Saved offline experiment to ${resolve(out, 'runs.json')}`);
    } finally {
        Math.random = originalRandom;
        await db.end();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
