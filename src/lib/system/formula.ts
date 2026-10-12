import { getXpRequiredForLevel, calculateLevel } from "./leveling";

import { getRankValue, BOSS_SCALING_CAPS } from "./rank-constants";

/** Legacy coefficient retained for historical debug-script compatibility only. */
export const CONSTANTS = {
    B: 0.05,
};

/**
 * Calculates the total XP required to reach a specific level.
 * Compatibility helper for the canonical tuned curve in leveling.ts.
 */
export function calculateXpForLevel(level: number): number {
    return getXpRequiredForLevel(level);
}

/**
 * Calculates the current player Level based on total XP.
 * Uses the same capped curve as XP rewards and the vitals strip.
 */
export function calculateLevelFromXp(xp: number): number {
    return calculateLevel(xp).level;
}

/**
 * Calculates XP required to go from current level to next level.
 * Returns the *total cumulative XP* needed for the next level.
 */
export function getNextLevelXp(currentLevel: number): number {
    return calculateXpForLevel(currentLevel + 1);
}

/**
 * Helper to get progress percentage within the current level.
 */
export function getLevelProgress(currentXp: number, currentLevel: number): number {
    const startXp = calculateXpForLevel(currentLevel);
    const endXp = calculateXpForLevel(currentLevel + 1);

    if (currentXp < startXp) return 0; // Should not happen if level is correct
    if (currentXp >= endXp) return 100; // Ready to level up

    const xpIntoLevel = currentXp - startXp;
    const xpNeededForLevel = endXp - startXp;

    return (xpIntoLevel / xpNeededForLevel) * 100;
}

/**
 * Calculates the Hunter Rank based on current Level.
 * Milestones:
 * E-Rank: 1-10
 * D-Rank: 11-20
 * C-Rank: 21-40
 * B-Rank: 41-60
 * A-Rank: 61-90
 * S-Rank: 91+
 */
export function rankValue(rank: string): number {
    return getRankValue(rank);
}

export function calculateRank(level: number, prestige: number = 0): string {
    if (prestige > 0) return "[Ω]";
    if (level < 11) return "E-RANK";
    if (level < 21) return "D-RANK";
    if (level < 41) return "C-RANK";
    if (level < 61) return "B-RANK";
    if (level < 91) return "A-RANK";
    return "S-RANK"; // Beyond 91+ is entirely S-Rank territory
}

/**
 * Returns true if the player has reached the transcendence threshold (999) and is in post-cap endgame.
 * This gates all post-999 mechanics: 2x boss HP/DMG, 2x quest XP, Cosmic drops, etc.
 * The player can continue leveling infinitely or choose to transcend.
 */
export function isPostCap(level: number): boolean {
    return level >= 999;
}

/**
 * Calculates the multiplier for Rewards based on player level.
 * Formula: 1 + (Level / 20)
 * Level 1: 1.05x
 * Level 20: 2.00x
 * Level 300: 16.00x
 */
export function calculateGlobalRewardMultiplier(level: number, prestige: number = 0): number {
    if (level < 1) return 1;

    // Linear scaling up to Level 100 (1.02x at L1, 3.0x at L100)
    // Soft-capped logarithmic scaling after Level 100 to prevent inflation from daily basic tasks
    let multiplier = level <= 100
        ? 1 + (level / 50)
        : 3.0 + Math.log(1 + (level - 100) / 20);

    // Prestige Multiplier: Each prestige level adds a compounding 100x bonus.
    if (prestige > 0) {
        multiplier = multiplier * Math.pow(100, prestige);
    }

    return multiplier;
}

/**
 * Calculates scaled mana cost based on Rank and Level.
 * Formula: BaseCost * (1 + (Level / 40))
 */
export function calculateScaledManaCost(baseMana: number, level: number = 1): number {
    if (baseMana <= 0) return 0;

    // Metabolic Equilibrium Formula
    const scalingFactor = 1 + (level / 40);
    const scaledCost = baseMana * scalingFactor;

    return Math.floor(scaledCost);
}

/**
 * Calculates the effective mana cost for an active skill.
 * Standard Formula: BaseCost + (SkillLevel * 2% of Max Mana)
 * Exception: MANA_RESTORATION (Dominator's Touch) is always 0.
 */
export function calculateSkillManaCost(baseMana: number, skillLevel: number, maxMana: number, effectType?: string): number {
    if (effectType === 'MANA_RESTORATION') return 0;

    const dynamicCostAddon = Math.floor(maxMana * (skillLevel * 0.02));
    return (baseMana || 0) + dynamicCostAddon;
}

export const DAILY_ALL_CLEAR_TARGET = 9;
export const DAILY_ALL_CLEAR_XP = 10_000;
export const DAILY_ALL_CLEAR_GOLD = 5_000;

/**
 * Calculates final scaled rewards (XP, Gold) for a quest based on level and stats.
 */
export function calculateScaledQuestReward(
    baseXp: number,
    baseGold: number,
    baseMana: number,
    level: number,
    stats?: { strength: number, agility: number, intelligence: number, vitality: number, perception: number },
    skillRewards?: Record<string, number> | null,
    completedDailies: number = 0,
    difficulty?: string,
    shadowBonuses: { xpMult?: number, manaDiscount?: number, goldMult?: number } = {},
    maxMana?: number
) {
    const multiplier = calculateGlobalRewardMultiplier(level);
    const scaledXpBase = Math.floor(baseXp * multiplier);
    const scaledGoldBase = Math.floor(baseGold * multiplier);

    let finalXp = scaledXpBase;
    let finalGold = scaledGoldBase;
    let synergyStat: string | null = null;
    let synergyBonusXp = 0;

    // 1. Synergy Boost
    if (stats && skillRewards) {
        let highestStatVal = 0;
        let bestStatKey = '';

        for (const key of Object.keys(skillRewards)) {
            const lowerKey = key.toLowerCase();
            const statValue = (stats as any)[lowerKey];
            if (typeof statValue === 'number' && statValue > 0) {
                if (statValue > highestStatVal) {
                    highestStatVal = statValue;
                    bestStatKey = key;
                }
            }
        }

        if (highestStatVal > 0) {
            // Synergy Cap: Max 5x bonus. Divisor 100.
            // 100 Stat -> 1.0x Bonus (100%)
            // 500 Stat -> 5.0x Bonus (500% - Cap)
            const rawMultiplier = highestStatVal / 100;
            const synMultiplier = Math.min(rawMultiplier, 5.0);
            synergyBonusXp = Math.floor(scaledXpBase * synMultiplier);
            const synergyBonusGold = Math.floor(scaledGoldBase * synMultiplier);

            finalXp += synergyBonusXp;
            finalGold += synergyBonusGold;
            synergyStat = bestStatKey;
        }
    }

    // 2. Daily Streak Multiplier (1.5x at 9+ completions)
    const isStreakActive = completedDailies >= DAILY_ALL_CLEAR_TARGET;
    if (isStreakActive) {
        finalXp = Math.floor(finalXp * 1.5);
    }

    // 3. Shadow Bonuses
    const xpMult = shadowBonuses.xpMult || 1.0;
    finalXp = Math.floor(finalXp * xpMult);

    const goldMult = shadowBonuses.goldMult || 1.0;
    finalGold = Math.floor(finalGold * goldMult);

    const manaDiscount = shadowBonuses.manaDiscount || 1.0;
    let finalManaCost = Math.floor(calculateScaledManaCost(baseMana, level) * manaDiscount);

    // 4. CAPS (Metabolic Equilibrium)
    // Cap at 75% of Max Mana to prevent impossible costs for high-difficulty quests
    if (maxMana) {
        const cap = Math.floor(maxMana * 0.75);
        if (finalManaCost > cap) finalManaCost = cap;
    }

    return {
        finalXp,
        finalGold,
        finalManaCost,
        synergyStat,
        synergyBonusXp,
        levelMult: multiplier,
        hasBonus: finalXp > baseXp || finalGold > baseGold || isStreakActive || xpMult > 1 || manaDiscount < 1
    };
}

/**
 * Calculates damage dealt by a boss to a player using a mitigation formula.
 */
export function calculateBossDamage(baseAtk: number, playerDef: number, variance: number = 1.0) {
    const rawDamage = baseAtk * variance;
    // Mitigation formula: 100 / (100 + DEF)
    const mitigation = 100 / (100 + playerDef);
    return Math.max(1, Math.floor(rawDamage * mitigation));
}

/**
 * Calculates the Max HP for a boss based on their rank and the player's level.
 */
export function calculateBossMaxHP(bossRank: string, playerLevel: number, dbHP: number, isPostCapPlayer: boolean): number {
    const rankKey = bossRank.replace('-RANK', '').trim().toUpperCase();

    let baseHP = 250;
    if (rankKey === 'E') baseHP = 250;
    if (rankKey === 'D') baseHP = 600;
    if (rankKey === 'C') baseHP = 1000;
    if (rankKey === 'B') baseHP = 2200;
    if (rankKey === 'A') baseHP = 3600;
    if (rankKey === 'S') baseHP = 16000;
    if (rankKey === 'S+') baseHP = 24000;
    if (rankKey === 'XX') baseHP = 33000;
    if (rankKey === 'COSMIC') baseHP = 5000000;

    const linearMult = 1 + (playerLevel / 20);
    let totalMult = linearMult;

    const cap = BOSS_SCALING_CAPS[rankKey] || 50;
    totalMult = Math.min(totalMult, cap);

    let scaledHP = Math.floor(baseHP * totalMult);

    if (isPostCapPlayer && rankKey !== 'COSMIC') {
        scaledHP = scaledHP * 2;
    }

    return Math.max(dbHP || 1000, scaledHP);
}


// ============================================
// ITEM SCALING SYSTEM (The "Living Arsenal")
// ============================================

export const ITEM_RANK_CEILINGS: Record<string, number> = {
    'E': 5,      // Low-tier junk gear hits a hard wall early.
    'D': 10,
    'C': 25,
    'B': 50,
    'A': 100,
    'S': 250,
    'S+': 500,
    'XX': 1000,
    'COSMIC': 9999, // Effectively uncapped
};

export const SCALABLE_ATTRIBUTES = [
    'strength', 'agility', 'intelligence', 'vitality', 'perception',
    'damage_min', 'damage_max', 'defense', 'hp_flat', 'mana_flat',
    'armor_penetration', 'luck', 'charisma', 'focus', 'willpower'
];

/**
 * Calculates the dynamic scaling factor for an item based on player level and rank.
 * Formula: 1 + (Level / 25)
 */
/**
 * Standardize: "E-RANK", "E-RANK EQUIPMENT", "E", "S Rank" -> "E", "S"
 */
function getCleanRank(rank: any): string {
    if (!rank) return 'E';
    const str = rank.toString().toUpperCase();
    const parts = str.split(/[\s-]+/); // Split by space or dash
    const firstPart = parts[0];
    return firstPart.replace(/RANK/g, '').trim();
}

/**
 * Calculates the dynamic scaling factor for an item based on player level and rank.
 * Formula: 1 + (Level / 25)
 */
export function calculateItemStatScale(rank: string, level: number): number {
    const baseMult = 1 + (level / 25);
    const cleanRank = getCleanRank(rank);
    const ceiling = ITEM_RANK_CEILINGS[cleanRank] || 5;

    return Math.min(baseMult, ceiling);
}

/**
 * Safely scales an item's effects based on player level and rank.
 * Handles both JSON strings and objects.
 */
export function scaleItemEffect(it: any, playerLevel: number): any {
    if (!it) return it;

    // Robust type check
    const type = (it.type || '').toString().toUpperCase();
    if (type !== 'EQUIPMENT') return it;

    let effect = it.effect;
    if (typeof effect === 'string') {
        try {
            effect = JSON.parse(effect);
        } catch (e) {
            console.error("[Scaling] Failed to parse item effect JSON:", e);
            return it;
        }
    }

    if (!effect) return it;

    const rank = it.rarity || it.rank || 'E';
    const scaleFactor = calculateItemStatScale(rank, playerLevel);

    if (scaleFactor <= 1) return it;

    const scaledEffect = { ...effect };
    SCALABLE_ATTRIBUTES.forEach(stat => {
        const baseVal = scaledEffect[stat];
        if (typeof baseVal === 'number' && baseVal > 0) {
            scaledEffect[stat] = Math.round(baseVal * scaleFactor);
        }
    });

    return {
        ...it,
        effect: scaledEffect,
        scale_factor: scaleFactor
    };
}
