import type { BossOutgoingDamageResolver } from './boss-combat';

export const BOSS_BALANCE_VERSION = 2;
export const BOSS_DAY_TIMEZONE = 'UTC';
export const LEGACY_BOSS_COOLDOWNS: Record<string, number> = { E: 1, C: 2, D: 3, B: 4, A: 5, S: 7, 'S+': 14, XX: 30, COSMIC: 60 };
export const CURRENT_BOSS_COOLDOWNS: Record<string, number> = { ...LEGACY_BOSS_COOLDOWNS, S: 3, 'S+': 7, XX: 14 };
export const BOSS_RANK_REWARDS: Record<string, { xp: number; gold: number }> = {
    E: { xp: 100, gold: 200 }, D: { xp: 250, gold: 500 }, C: { xp: 500, gold: 1000 },
    B: { xp: 1000, gold: 5000 }, A: { xp: 2500, gold: 20000 }, S: { xp: 5000, gold: 100000 },
    'S+': { xp: 10000, gold: 500000 }, XX: { xp: 20000, gold: 1000000 }, COSMIC: { xp: 100000, gold: 5000000 },
};

export function normalizeBossRank(rank: string) {
    return String(rank || 'E').trim().toUpperCase().split(/[\s-]+/)[0];
}

export function isBossBountyEligible(boss: { rank: string; phase?: number | null }) {
    return (boss.phase === 3 || boss.phase === 4) && ['S', 'S+', 'XX'].includes(normalizeBossRank(boss.rank));
}

export function getBossRepeatRewardScale(rank: string) {
    const clean = normalizeBossRank(rank);
    return (CURRENT_BOSS_COOLDOWNS[clean] || 1) / (LEGACY_BOSS_COOLDOWNS[clean] || 1);
}

/** Same smooth pre-cap curve used in the corrected simulation. Cosmic is excluded by the caller. */
export const resolveBalancedBossDamage: BossOutgoingDamageResolver = ({ uncappedDirect, summon, levelMultiplier, maxHp, difficulty }) => {
    const ceilings: Record<string, number> = { E: 0.18, D: 0.24, C: 0.32, B: 0.40, A: 0.55, S: 0.75, 'S+': 1, XX: 1 };
    const levelBonus = 1 + (levelMultiplier - 1) * 0.2;
    const direct = uncappedDirect / levelMultiplier * levelBonus * 1.25;
    const factor = 1 / (1 + (direct + summon) / (maxHp * (ceilings[difficulty] ?? 0.4)));
    return { direct: direct * factor, summon: summon * factor };
};
