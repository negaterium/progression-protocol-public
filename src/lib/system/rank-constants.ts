/**
 * Centralized Rank Constants and Utilities
 * Source of truth for level requirements, estimated levels, combat attributes,
 * sorting order, key mapping, and failure penalty percentages.
 */

/** Equipment/key entry requirements; these are distinct from hunter display ranks. */
export const RANK_LEVELS: Record<string, number> = {
    'E': 10,
    'D': 20,
    'C': 40,
    'B': 50,
    'A': 65,
    'S': 80,
    'COSMIC': 999  // Cosmic bosses require Level 999 (post-cap)
};

export const BOSS_RANK_LEVEL: Record<string, number> = {
    'E': 1,
    'D': 15,
    'C': 30,
    'B': 50,
    'A': 75,
    'S': 110,
    'S+': 125,
    'XX': 150,
    'COSMIC': 999
};

export const BOSS_BASE_ATK: Record<string, number> = {
    'E': 100,
    'D': 250,
    'C': 800,
    'B': 700,
    'A': 2500,
    'S': 3000,
    'S+': 5000,
    'XX': 8000
};

export const BOSS_DEF: Record<string, number> = {
    'E': 0,
    'D': 20,
    'C': 50,
    'B': 80,
    'A': 120,
    'S': 200,
    'S+': 500,
    'XX': 500
};

export const QUEST_RANK_MULT: Record<string, number> = {
    'E': 0.5,
    'D': 0.8,
    'C': 1.2,
    'B': 2.0,
    'A': 3.0,
    'S': 5.0,
    'S+': 10.0,
    'XX': 10.0
};

export const BOSS_RANK_KEY_SUFFIX: Record<string, string> = {
    'E': 'E-Rank',
    'D': 'D-Rank',
    'C': 'C-Rank',
    'B': 'B-Rank',
    'A': 'A-Rank',
    'S': 'S-Rank',
    'S+': 'S+-Rank',
    'X': 'S-Rank',
    'XX': 'XX-Rank',
    '???': 'S-Rank',
    'COSMIC': 'Cosmic'
};

export const RANK_VALUE: Record<string, number> = {
    'E': 0,
    'D': 1,
    'C': 2,
    'B': 3,
    'A': 4,
    'S': 5,
    'S+': 6,
    'XX': 7,
    'COSMIC': 8
};

export const PENALTY_PERCENT: Record<string, number> = {
    'E': 0.10,
    'D': 0.20,
    'C': 0.30,
    'B': 0.40,
    'A': 0.50,
    'S': 0.50
};

/**
 * Normalizes a rank string and retrieves its numerical hierarchy value for comparisons.
 */
export function getRankValue(rank: string | null | undefined): number {
    if (!rank) return 0;
    const clean = rank.toString().trim().toUpperCase();
    if (clean.startsWith('COSMIC')) return RANK_VALUE['COSMIC'];
    if (clean.startsWith('XX')) return RANK_VALUE['XX'];
    if (clean.startsWith('S+')) return RANK_VALUE['S+'];

    const baseRank = clean.split(/[\s-]+/)[0].trim();
    return RANK_VALUE[baseRank] ?? 0;
}

export const BOSS_KEY_DROP_CHANCE: Record<string, number> = {
    'E': 0.70,
    'D': 0.70,
    'C': 0.70,
    'B': 0.80,
    'A': 0.80,
    'S': 1.00,
    'S+': 1.00,
    'X': 1.00,
    'XX': 1.00,
    '???': 1.00,
    'COSMIC': 1.00
};

/**
 * Returns the key drop probability (0.0 to 1.0) based on the boss rank.
 * Rank S and higher (S, S+, XX, COSMIC) are guaranteed 100% (1.0).
 * Lower tiers (E through A) have a minimum 70% chance (up to 80% for B and A).
 */
export function getBossKeyDropChance(rank: string | null | undefined): number {
    if (!rank) return 0.70;
    const clean = rank.toString().trim().toUpperCase();
    if (clean.startsWith('COSMIC')) return BOSS_KEY_DROP_CHANCE['COSMIC'];
    if (clean.startsWith('XX')) return BOSS_KEY_DROP_CHANCE['XX'];
    if (clean.startsWith('S+')) return BOSS_KEY_DROP_CHANCE['S+'];
    const baseRank = clean.split(/[\s-]+/)[0].trim();
    return BOSS_KEY_DROP_CHANCE[baseRank] ?? 0.70;
}

/**
 * Normalizes any rank string to its corresponding Instant Dungeon Key name suffix.
 * Guarantees that bosses drop and require keys matching their own rank tier (same level).
 */
export function getBossKeySuffix(rank: string | null | undefined): string {
    if (!rank) return 'E-Rank';
    const clean = rank.toString().trim().toUpperCase();
    if (clean.startsWith('COSMIC')) return 'Cosmic';
    if (clean.startsWith('XX')) return 'XX-Rank';
    if (clean.startsWith('S+')) return 'S+-Rank';
    const baseRank = clean.split(/[\s-]+/)[0].trim();
    return BOSS_RANK_KEY_SUFFIX[baseRank] || `${baseRank}-Rank`;
}

/** Shared HP/attack scaling ceilings; preserve the existing combat balance. */
export const BOSS_SCALING_CAPS: Record<string, number> = {
    'E': 25, 'D': 60, 'C': 120, 'B': 400, 'A': 1500,
    'S': 20, 'S+': 40, 'XX': 100, 'COSMIC': 9999,
};
