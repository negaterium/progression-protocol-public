/** Offline, fixed-level balance experiment. Never imported by gameplay code. */
export const DAY_MS = 86_400_000;

export interface SimulationBoss {
    id: string;
    name: string;
    rank: string;
    phase: number;
    required_level: number;
    max_hp: number;
    defeated: boolean;
    last_started_at?: string | null;
}

export interface QuestEvent { at: number; difficulty: string; xp: number; manaCost?: number | null; manaReward?: number; delegated?: boolean; assignmentCount?: number }
export interface BalancePolicy {
    name: string;
    cooldowns: Record<string, number>;
    rewardScale: Record<string, number>;
    /** Experimental attenuation AFTER the production damage calculation. */
    damageScale: number;
    totalDamageCaps: Record<string, number>;
}
export interface RoundRequest {
    boss: SimulationBoss;
    hp: number;
    maxHp: number;
    difficulty: string;
}
export interface RoundSample { damage: number; incomingHpFraction: number }
export interface SimulationInput {
    bosses: SimulationBoss[];
    events: QuestEvent[];
    days: number;
    warmupDays: number;
    level: number;
    /** Seeded timestamp projection for the current account's cooldown state. */
    initialReadyAt?: Record<string, number>;
    hpForBoss: (boss: SimulationBoss) => number;
    rewardForBoss: (boss: SimulationBoss, firstClear: boolean) => { xp: number; gold: number; loot: number };
    repeatRewardScale?: (boss: SimulationBoss, sinceLastRewardMs: number | undefined, fixedScale: number) => number;
    round: (request: RoundRequest) => Promise<RoundSample>;
    beforeEvent?: (event: QuestEvent) => boolean;
    afterCombat?: (event: QuestEvent, defeated: boolean, firstClear: boolean) => void;
}

export function seededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4_294_967_296;
    };
}

export function applyDamagePolicy(damage: number, maxHp: number, difficulty: string, policy: BalancePolicy) {
    const cap = policy.totalDamageCaps[difficulty] ?? 1;
    return Math.max(0, Math.min(Math.floor(damage * policy.damageScale), Math.floor(maxHp * cap)));
}

export async function simulateBossBalance(input: SimulationInput, policy: BalancePolicy) {
    if (!Number.isInteger(input.days) || input.days <= 0 || !Number.isInteger(input.warmupDays) || input.warmupDays < 0 || input.warmupDays >= input.days) throw new Error('Invalid simulation horizon');
    if (input.events.some(e => !Number.isFinite(e.at) || e.at < 0 || e.at >= input.days * DAY_MS)) throw new Error('Event outside horizon');
    const bosses = input.bosses.filter(b => b.required_level <= input.level).sort((a, b) =>
        a.phase - b.phase || a.required_level - b.required_level || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const states = new Map(bosses.map(b => [b.id, {
        readyAt: input.initialReadyAt?.[b.id] ?? 0, lastStart: -Infinity, cleared: b.defeated,
        lastRewardAt: undefined as number | undefined,
    }]));
    let active: { boss: SimulationBoss; hp: number; maxHp: number; rounds: number; incoming: number; started: number } | undefined;
    let kills = 0, bossXp = 0, gold = 0, loot = 0, shadowUpgrades = 0, keyBalance = 0;
    let idleQuests = 0, measuredQuests = 0, combatQuests = 0;
    let blockedQuests = 0, blockedQuestXp = 0, totalQuestXp = 0;
    const idleDays = new Set<number>();
    const activeDays = new Set<number>();
    const fightRounds: number[] = [], fightHours: number[] = [], incomingFractions: number[] = [];
    const byBoss: Record<string, number> = {};
    const cutoff = input.warmupDays * DAY_MS;
    const events = [...input.events].sort((a, b) => a.at - b.at);
    for (const event of events) {
        const measured = event.at >= cutoff;
        if (measured) { measuredQuests++; activeDays.add(Math.floor(event.at / DAY_MS)); }
        if (measured) totalQuestXp += event.xp;
        if (input.beforeEvent && !input.beforeEvent(event)) {
            if (measured) { blockedQuests++; blockedQuestXp += event.xp; }
            continue;
        }
        if (!active) {
            const eligible = bosses.filter(b => {
                const s = states.get(b.id)!;
                const previous = bosses.filter(p => p.phase === b.phase).findLast(p =>
                    p.required_level < b.required_level || (p.required_level === b.required_level && (p.name < b.name || (p.name === b.name && p.id < b.id))));
                return s.readyAt <= event.at && (!previous || states.get(previous.id)!.cleared);
            });
            // Prefer the current progression tier, rotate fairly within it.
            eligible.sort((a, b) => b.phase - a.phase || states.get(a.id)!.lastStart - states.get(b.id)!.lastStart || a.required_level - b.required_level || a.name.localeCompare(b.name));
            const boss = eligible[0];
            if (boss) {
                const maxHp = input.hpForBoss(boss);
                if (!Number.isFinite(maxHp) || maxHp <= 0) throw new Error('Invalid boss HP');
                active = { boss, hp: maxHp, maxHp, rounds: 0, incoming: 0, started: event.at };
                states.get(boss.id)!.lastStart = event.at;
                if (measured) keyBalance--; // Unlimited entry keys are an explicit assumption.
            }
        }
        if (!active) {
            if (measured) { idleQuests++; idleDays.add(Math.floor(event.at / DAY_MS)); }
            continue;
        }
        if (measured) combatQuests++;
        const sample = await input.round({ boss: active.boss, hp: active.hp, maxHp: active.maxHp, difficulty: event.difficulty });
        if (!Number.isFinite(sample.damage) || sample.damage < 0) throw new Error('Invalid combat damage');
        active.rounds++;
        active.hp -= applyDamagePolicy(sample.damage, active.maxHp, event.difficulty, policy);
        active.incoming += sample.incomingHpFraction;
        input.afterCombat?.(event, active.hp <= 0, !states.get(active.boss.id)!.cleared);
        if (active.hp > 0) continue;
        const state = states.get(active.boss.id)!;
        const fixedScale = policy.rewardScale[active.boss.rank] ?? 1;
        const scale = state.cleared ? (input.repeatRewardScale?.(active.boss,
            state.lastRewardAt === undefined ? undefined : event.at - state.lastRewardAt, fixedScale) ?? fixedScale) : 1;
        if (!Number.isFinite(scale) || scale < 0 || scale > 1) throw new Error('Invalid repeat reward scale');
        if (measured) {
            kills++;
            const reward = input.rewardForBoss(active.boss, !state.cleared);
            bossXp += Math.floor(reward.xp * scale);
            gold += Math.floor(reward.gold * scale);
            loot += reward.loot * scale;
            shadowUpgrades += state.cleared ? scale : 0;
            keyBalance++; // Relevant S/S+/XX bosses currently return their entry key.
            fightRounds.push(active.rounds);
            fightHours.push((event.at - active.started) / 3_600_000);
            incomingFractions.push(active.incoming);
            byBoss[active.boss.name] = (byBoss[active.boss.name] || 0) + 1;
        }
        state.cleared = true;
        state.lastRewardAt = event.at;
        // Match current gameplay: midnight of encounter START + rank cooldown.
        state.readyAt = (Math.floor(active.started / DAY_MS) + (policy.cooldowns[active.boss.rank] ?? 1)) * DAY_MS;
        active = undefined;
    }
    const mean = (values: number[]) => values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const sortedRounds = [...fightRounds].sort((a, b) => a - b);
    return {
        name: policy.name, kills, bossXp, gold, expectedLootUnits: loot, expectedShadowUpgrades: shadowUpgrades,
        netKeys: keyBalance, measuredQuests, combatQuests, idleQuests, activeDays: activeDays.size,
        blockedQuests, blockedQuestXp, totalQuestXp,
        daysWithIdleQuests: idleDays.size, meanFightRounds: mean(fightRounds),
        medianFightRounds: sortedRounds.length ? sortedRounds[Math.floor(sortedRounds.length / 2)] : 0,
        meanFightHours: mean(fightHours), meanIncomingHpBars: mean(incomingFractions),
        twoRoundKills: fightRounds.filter(n => n <= 2).length, byBoss,
        unfinishedBoss: active?.boss.name ?? null,
    };
}
