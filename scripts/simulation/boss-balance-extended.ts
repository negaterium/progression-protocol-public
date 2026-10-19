/** Pre-cap damage, resource and reward-cadence experiment. Never loads an env file. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { syntheticSnapshot, type SimulationSnapshot } from './snapshot';
import { DAY_MS, seededRandom, simulateBossBalance, type BalancePolicy, type QuestEvent } from '../../src/lib/simulation/boss-balance';
import { BossResourceReplay } from '../../src/lib/simulation/boss-resources';
import { CombatXpBudget } from '../../src/lib/simulation/combat-xp-budget';
import { LEGACY_BOSS_COOLDOWNS as BOSS_COOLDOWNS, resolveBalancedBossDamage } from '../../src/lib/game-logic/boss-balance-policy';
import { BOSS_LOOT_TABLE } from '../../src/lib/game-logic/boss-loot';
import { calculateBossMaxHP, calculateGlobalRewardMultiplier } from '../../src/lib/system/formula';
import { StatsManager } from '../../src/lib/stats-manager';
import type { BossOutgoingDamageResolver } from '../../src/lib/game-logic/boss-combat';

async function main() {
    const args = process.argv.slice(2);
    const arg = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
    const seeds = Number(arg('--seeds', '12'));
    if (!Number.isInteger(seeds) || seeds < 1 || seeds > 100) throw new Error('Expected 1–100 seeds');
    const path = arg('--snapshot', '');
    if (!path && !args.includes('--synthetic')) throw new Error('Supply --snapshot PATH or --synthetic');
    const snapshot: SimulationSnapshot = path ? JSON.parse(readFileSync(resolve(path), 'utf8')) : syntheticSnapshot();
    if (!snapshot.resourceStats || snapshot.traceDays !== 28) throw new Error('Expected a corrected 28-day resource snapshot');
    const out = resolve(arg('--out', 'scratch/boss-balance-extended'));
    const { default: db } = await import('../../src/lib/db');
    const { gameDb } = await import('../../src/lib/server/game-db');
    const forbidden = async (): Promise<never> => { throw new Error('SQL forbidden in offline experiment'); };
    db.query = forbidden; db.queryOne = forbidden; db.getClient = forbidden; db.transaction = forbidden;
    gameDb.query = forbidden; gameDb.transaction = forbidden;
    let currentEvent: QuestEvent | undefined;
    gameDb.queryOne = async <T>(sql: string): Promise<T | null> => {
        if (!sql.includes('FROM shadow_assignments')) throw new Error('Unexpected combat lookup');
        return currentEvent?.delegated ? { shadow_count: currentEvent.assignmentCount || 10 } as T : null;
    };
    const { calculateBossCombatRound } = await import('../../src/lib/game-logic/boss-combat');
    const { RANK_REWARDS } = await import('../../src/lib/server/boss-rewards');
    const shorter: Record<string, number> = { ...BOSS_COOLDOWNS, S: 3, 'S+': 7, XX: 14 };
    const scales = Object.fromEntries(Object.entries(shorter).map(([rank, days]) => [rank, days / BOSS_COOLDOWNS[rank]]));
    const caps: Record<string, number> = { E: 0.18, D: 0.24, C: 0.32, B: 0.40, A: 0.55, S: 0.75, 'S+': 1, XX: 1 };
    const policies = [
        { name: 'current', cooldowns: BOSS_COOLDOWNS, rewardScale: {}, smoothing: 0, recovery: false },
        { name: 'previous-candidate', cooldowns: shorter, rewardScale: scales, smoothing: -1, recovery: false },
        ...[0.75, 1, 1.25].map(smoothing => ({ name: `precap-${smoothing}`, cooldowns: shorter, rewardScale: scales, smoothing, recovery: false })),
        { name: 'precap-time-earned', cooldowns: shorter, rewardScale: scales, smoothing: 1, recovery: true },
        { name: 'precap-budgeted-xp', cooldowns: shorter, rewardScale: scales, smoothing: 1.25, recovery: false },
    ];
    const variants = [
        { name: 'observed-legacy-hp', statScale: 1, daily: 0, potions: false, unified: false, burst: false },
        { name: 'observed-with-potions', statScale: 1, daily: 0, potions: true, unified: false, burst: false },
        { name: 'observed-unified-hp', statScale: 1, daily: 0, potions: false, unified: true, burst: false },
        { name: 'weaker-build', statScale: 0.65, daily: 0, potions: false, unified: false, burst: false },
        { name: 'stronger-build', statScale: 1.5, daily: 0, potions: false, unified: false, burst: false },
        { name: 'five-E-daily', statScale: 1, daily: 5, potions: false, unified: false, burst: false },
        { name: 'twenty-E-daily', statScale: 1, daily: 20, potions: false, unified: false, burst: false },
        { name: 'batched-twenty-E', statScale: 1, daily: 20, potions: false, unified: false, burst: true },
    ];
    const runs: Record<string, any>[] = [];
    const summaries: Record<string, any>[] = [];
    const originalRandom = Math.random;
    try {
        for (const mode of ['steady', 'current-state']) {
            const warmupDays = mode === 'steady' ? 56 : 0;
            const days = warmupDays + 28;
            for (const variant of variants) {
                const events: QuestEvent[] = variant.daily ? Array.from({ length: days * variant.daily }, (_, i) => ({
                    at: Math.floor(i / variant.daily) * DAY_MS + 9 * 3_600_000 + (i % variant.daily) * (variant.burst ? 10000 : 12 * 3_600_000 / variant.daily),
                    difficulty: 'E', xp: 100, manaCost: 10,
                })) : Array.from({ length: days / 28 }, (_, cycle) => snapshot.quests.map(q => ({ ...q, at: q.at + cycle * 28 * DAY_MS }))).flat();
                for (const policy of policies) {
                    for (let seed = 1; seed <= seeds; seed++) {
                        Math.random = seededRandom(seed);
                        const resource = snapshot.resourceStats;
                        const stats = Object.fromEntries(Object.entries(snapshot.combat.effectiveStats || {}).map(([k, v]) => [k, v * variant.statScale]));
                        const gear = snapshot.combat.equipmentList.map(g => ({ ...g, effect: Object.fromEntries(Object.entries(g.effect || {}).map(([k, v]) =>
                            [k, typeof v === 'number' && ['damage_min', 'damage_max', 'strength', 'intelligence', 'agility', 'vitality', 'defense'].includes(k) ? v * variant.statScale : v])) }));
                        const modifiers = resource.modifiers;
                        const maxHp = StatsManager.calculateMaxHP(stats.vitality, stats.strength, snapshot.level, modifiers, snapshot.combat.hunterClass);
                        const maxMana = StatsManager.calculateMaxMana(stats.intelligence, snapshot.level, modifiers, snapshot.combat.hunterClass);
                        const rawHp = 100 + resource.rawVitality * 10;
                        const combatHp = variant.unified ? maxHp : rawHp;
                        const manaModifiers = StatsManager.aggregateModifiers([...gear.map(g => g.effect), snapshot.combat.skillModifiers || {}, ...snapshot.combat.titleModifiers]);
                        const state = new BossResourceReplay({ maxHp, maxMana, combatHpLimit: combatHp, statusHpBase: rawHp,
                            hunterClass: snapshot.combat.hunterClass, level: snapshot.level, modifiers,
                            manaModifiers, potions: variant.potions, measuredFrom: warmupDays * DAY_MS });
                        const balance: BalancePolicy = { ...policy, damageScale: 1, totalDamageCaps: {} };
                        const eligibleBosses = snapshot.bosses.filter(b => b.phase >= 3 && b.phase <= 4 && b.required_level <= snapshot.level);
                        // One shared rank/level budget, not a separate allowance for each extra battle.
                        const dailyBossXp = eligibleBosses.reduce((sum, boss) => sum + (RANK_REWARDS[boss.rank]?.xp || 0)
                            * calculateGlobalRewardMultiplier(snapshot.level) * (snapshot.observedBossXpMultiplier ?? 1) / BOSS_COOLDOWNS[boss.rank], 0) * 0.7;
                        const budget = new CombatXpBudget(dailyBossXp, warmupDays * DAY_MS);
                        const budgeted = policy.name === 'precap-budgeted-xp';
                        let uncappedHits = 0, evaluatedHits = 0;
                        const resolver: BossOutgoingDamageResolver | undefined = policy.smoothing === 0 ? undefined : damage => {
                            const { uncappedDirect, summon, maxHp: bossHp, difficulty, levelMultiplier } = damage;
                            let direct: number, army: number;
                            if (policy.smoothing === -1) {
                                const limit: Record<string, number> = { E: 0.09, D: 0.12, C: 0.16, B: 0.20, A: 0.25, S: 0.30, 'S+': 0.35, XX: 0.35 };
                                direct = Math.min(uncappedDirect, bossHp * 0.5) * 0.35;
                                army = summon * 0.35;
                                const factor = Math.min(1, bossHp * (limit[difficulty] ?? 1) / Math.max(1, direct + army));
                                direct *= factor; army *= factor;
                            } else {
                                if (policy.smoothing === 1.25) {
                                    const resolved = resolveBalancedBossDamage(damage);
                                    if (currentEvent!.at >= warmupDays * DAY_MS) { uncappedHits += uncappedDirect; evaluatedHits += resolved.direct + resolved.summon; }
                                    return resolved;
                                }
                                const levelBonus = 1 + (levelMultiplier - 1) * 0.2;
                                direct = uncappedDirect / levelMultiplier * levelBonus * policy.smoothing;
                                army = summon;
                                const raw = direct + army;
                                const ceiling = bossHp * (caps[difficulty] ?? 0.4);
                                // Continuous diminishing returns preserve build differences below the asymptote.
                                const factor = 1 / (1 + raw / ceiling);
                                direct *= factor; army *= factor;
                            }
                            if (currentEvent!.at >= warmupDays * DAY_MS) { uncappedHits += uncappedDirect; evaluatedHits += direct + army; }
                            return { direct, summon: army };
                        };
                        const bosses = snapshot.bosses.filter(b => b.phase >= 3 && b.phase <= 4);
                        const capturedDay = Date.parse(snapshot.capturedAt.slice(0, 10));
                        const initialReadyAt = mode === 'current-state' ? Object.fromEntries(bosses.map(b => [b.id, b.last_started_at
                            ? Math.max(0, Date.parse(b.last_started_at.slice(0, 10)) + (policy.cooldowns[b.rank] ?? 1) * DAY_MS - capturedDay) : 0])) : undefined;
                        const result = await simulateBossBalance({ bosses, events, days, warmupDays, level: snapshot.level, initialReadyAt,
                            beforeEvent: event => { currentEvent = event; return state.beforeEvent(event); },
                            afterCombat: budgeted ? (event, defeated, firstClear) => { if (!firstClear) budget.combat(event.at, event.difficulty, defeated); } : undefined,
                            hpForBoss: boss => calculateBossMaxHP(boss.rank, snapshot.level, boss.max_hp, false),
                            rewardForBoss: (boss, firstClear) => {
                                const base = RANK_REWARDS[boss.rank] || RANK_REWARDS.C;
                                const mult = calculateGlobalRewardMultiplier(snapshot.level);
                                return { xp: budgeted && !firstClear ? 0 : Math.floor(Math.floor(base.xp * mult) * (snapshot.observedBossXpMultiplier ?? 1)),
                                    gold: Math.floor(base.gold * mult),
                                    loot: (BOSS_LOOT_TABLE[boss.name] || []).reduce((sum, e) => sum + e.chance * e.quantity, 0) };
                            },
                            repeatRewardScale: policy.recovery ? (boss, since, initial) => since === undefined ? initial
                                : Math.min(1, since / (BOSS_COOLDOWNS[boss.rank] * DAY_MS)) : undefined,
                            round: async ({ boss, hp, maxHp: bossHp, difficulty }) => {
                                const statusScale = Math.max(0, 1 + state.effects.reduce((sum, e) => sum + ((e.modifiers?.stat_multiplier ?? 1) - 1), 0));
                                const originalBoss = snapshot.bosses.find(b => b.id === boss.id)!;
                                const round = await calculateBossCombatRound({ ...snapshot.combat, equipmentList: gear, equipment: gear.map(g => g.effect),
                                    effectiveStats: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v * statusScale])),
                                    currentPlayerMana: state.mana, maxPlayerHp: combatHp, activeEffects: state.effects, statusEffects: state.effects, isStunned: state.stunned,
                                    questDifficulty: difficulty, activeEncounter: { id: 'offline', boss_id: boss.id, boss_name: boss.name, boss_rank: boss.rank,
                                        current_hp: hp, max_hp: bossHp, intel: originalBoss.intel || {}, damage_type: originalBoss.damage_type || 'PHYSICAL' },
                                }, resolver);
                                state.applyRound(round);
                                return { damage: round.damageDealt, incomingHpFraction: (round.playerDamage || 0) / maxHp };
                            },
                        }, balance);
                        // Blocked actions do not earn quest XP. Non-boss audit bonuses are conservatively prorated by quest XP weight.
                        const completion = result.totalQuestXp > 0 ? 1 - result.blockedQuestXp / result.totalQuestXp : 1 - result.blockedQuests / result.measuredQuests;
                        runs.push({ mode, variant: variant.name, policy: policy.name, seed, ...result, ...state.metrics,
                            bossXp: budgeted ? budget.grantedXp + result.bossXp : result.bossXp,
                            earnedCombatXp: budget.earnedXp, pendingCombatXp: budget.pendingXp, forfeitedCombatXp: budget.forfeitedXp,
                            netGold: result.gold - state.metrics.potionGold, totalXp: (result.bossXp + (budgeted ? budget.grantedXp : 0)) + snapshot.nonBossXp * completion,
                            uncappedHits, evaluatedHits, hpLimit: combatHp, trueMaxHp: maxHp });
                    }
                    const selected = runs.filter(r => r.mode === mode && r.variant === variant.name && r.policy === policy.name);
                    const mean = (key: string) => selected.reduce((sum, r) => sum + r[key], 0) / selected.length;
                    summaries.push({ mode, variant: variant.name, policy: policy.name,
                        ...Object.fromEntries(['kills', 'totalXp', 'bossXp', 'meanFightRounds', 'meanFightHours', 'blockedQuests', 'potionGold', 'netGold', 'attackFloorHits', 'clampLoss', 'idleQuests', 'measuredQuests', 'expectedLootUnits', 'expectedShadowUpgrades', 'pendingCombatXp', 'forfeitedCombatXp'].map(k => [k, mean(k)])) });
                }
            }
        }
        for (const row of summaries) {
            const baseline = summaries.find(r => r.mode === row.mode && r.variant === row.variant && r.policy === 'current')!;
            row.deltaCurrent = (row.totalXp / baseline.totalXp - 1) * 100;
            row.deltaObserved = snapshot.observedBossKills ? (row.totalXp / (snapshot.observedBossXp + snapshot.nonBossXp) - 1) * 100 : null;
        }
        mkdirSync(out, { recursive: true });
        const assumptions = [
            'Boss reward rows are excluded from the quest trace. Deleted quest definitions leave unknown mana costs at zero: resource risk is a lower bound.',
            'Exact current action behavior includes raw-vitality HP caps and a one-HP floor on boss hits. Unified-HP is a sensitivity, not a live fix.',
            'Incoming attacks, catalog abilities, turn statuses, purification, Mana Shield, Life Drain, passive time-based recovery, and delegated cost exemptions are replayed.',
            'No active skill activation schedule or daily full-restore bounty; no gold purchases for skills. Baseline and candidates use the same omissions.',
            'Passive regeneration is applied once per elapsed interval as though normal polling persists it. Real polling cadence and stat changes are not reconstructed.',
            'Potions assume replacement purchases at undiscounted standard catalog prices; inventory, gold constraints, free loot and status cures are not modeled.',
            'Gear/class/level progression and new unlocks remain frozen. Weaker/stronger variants scale effective stats and selected raw gear effects.',
            'Blocked quest XP and other audit bonuses are prorated using historical quest-XP weight; this is an estimate, not exact daily-bounty accounting.',
            'All variants hold observed non-boss XP fixed before blocked-action proration; synthetic schedules isolate boss effects.',
            'Repeated traces and approximate date-bucket cooldown projections do not reproduce future calendar, choices or boost timing.',
            'Budgeted-XP policy earns 70% of the eligible roster historical-theoretical XP rate. Four E-equivalents earn one daily allowance; at most two days of unused opportunity carry over. Half is paid on participation, half on victory, with a separate two-day payout bank cap. Gold/loot/shadows still use proportional repeat rewards.',
        ];
        writeFileSync(resolve(out, 'runs.json'), JSON.stringify({ seeds, quests: snapshot.quests.length, policies, assumptions, summaries, runs }, null, 2));
        const f = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
        writeFileSync(resolve(out, 'report.md'), [
            '# Extended boss balance experiment', '', `Corrected trace: ${snapshot.quests.length} quest events. ${seeds} seeds; ${runs.length} runs.`, '',
            '| Mode | Activity | Policy | Battles | XP | vs same-activity current | vs observed history | Rounds/fight | Blocked quests | Recovery gold |',
            '|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
            ...summaries.map(r => `| ${r.mode} | ${r.variant} | ${r.policy} | ${f(r.kills)} | ${f(r.totalXp)} | ${f(r.deltaCurrent)}% | ${r.deltaObserved === null ? 'n/a' : f(r.deltaObserved) + '%'} | ${f(r.meanFightRounds)} | ${f(r.blockedQuests)} | ${f(r.potionGold)} |`), '',
            '## Limits', '', ...assumptions.map(a => `- ${a}`), '',
            'The previous first-pass results used boss reward log rows as extra quest events and omitted retaliation. They are superseded by this corrected experiment. No balance settings have been deployed.',
        ].join('\n'));
        console.table(summaries.filter(r => r.mode === 'steady' && ['observed-legacy-hp', 'five-E-daily'].includes(r.variant)));
        console.log(`Saved ${runs.length} offline runs to ${out}`);
    } finally { Math.random = originalRandom; await db.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
