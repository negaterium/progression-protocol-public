/**
 * Canonical cumulative XP curve used by rewards, UI progress and prestige resets.
 * Levels 1–100 use linear steps (base 5,500; slope 80).
 * Levels 101–154 preserve historical progression; the later glide and steady
 * endgame curve bring Level 999 to approximately 114.3 million cumulative XP.
 * The cap, thresholds and reward pacing are unchanged by the integrity pass.
 */

export const LEVEL_CONSTANTS = {
    BASE: 5500,
    // SLOPE controls how fast the XP bar widens per level.
    // SLOPE=35 (old): Lv100 bar = 9,000 XP. Journey to Lv999 ≈ 54 days of active questing.
    // SLOPE=80 (new): Lv100 bar = 13,500 XP. Journey to Lv999 ≈ 99 days. More meaningful progression.
    SLOPE: 80
};

// Post-cap constants: XP overflow after Level 999 converts to Cosmic Essence
export const POST_CAP_XP_PER_CE = 100_000; // 100k XP = 1 Cosmic Essence

/**
 * Calculates how much Cosmic Essence would be earned from a given XP amount
 * when the player is already at Level 999 (post-cap).
 * Used by addXpAction to convert overflow XP.
 */
export function calculateCosmicEssenceGain(xpAmount: number): number {
    return Math.floor(xpAmount / POST_CAP_XP_PER_CE);
}

// Cumulative XP required to reach a specific Level from Level 1
export function getXpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;

    if (level <= 100) {
        // Base linear-step model for levels 1 to 100
        const n = level - 1;
        return (n * LEVEL_CONSTANTS.BASE) + (LEVEL_CONSTANTS.SLOPE * n * (n + 1) / 2);
    }

    // Baseline XP for Level 100
    const baseL100Xp = (99 * LEVEL_CONSTANTS.BASE) + (LEVEL_CONSTANTS.SLOPE * 99 * 100 / 2); // 940,500 XP

    // Seamless 10-Year Horizon Model:
    // - L101 to L154: Preserves exact historical progression (hunter remains Level 154 undisturbed)
    // - L155 to L200: Gentle glide from 194.7k down to 114k baseline over 45 levels
    // - L201 to L999: Steady scaling (+20 XP/level), reaching Level 999 in ~10 years max (~114.3M cumulative XP)
    let extraXp = 0;
    for (let k = 101;k <= level;k++) {
        if (k <= 154) {
            const delta = k - 100;
            extraXp += (LEVEL_CONSTANTS.BASE + LEVEL_CONSTANTS.SLOPE * k) + 110_000 + (2_500 * Math.pow(delta, 0.82));
        } else {
            const delta155 = k - 155;
            const GLIDE_STEPS = 45;
            const FLOOR = 114_000;
            if (delta155 <= GLIDE_STEPS) {
                const t = delta155 / GLIDE_STEPS;
                extraXp += Math.floor((194_740 * (1 - t)) + (FLOOR * t));
            } else {
                extraXp += Math.floor(FLOOR + (20 * (delta155 - GLIDE_STEPS)));
            }
        }
    }

    return Math.floor(baseL100Xp + extraXp);
}

export function calculateLevel(totalXp: number): { level: number; remainder: number; nextLevelXp: number; progress: number } {
    if (totalXp <= 0) {
        return { level: 1, remainder: 0, nextLevelXp: getXpRequiredForLevel(2), progress: 0 };
    }

    // Binary search for precise level determination (up to max level 999 / cap)
    let low = 1;
    let high = 999;
    let level = 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (getXpRequiredForLevel(mid) <= totalXp) {
            level = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    // XP to reach current Level start
    const xpToReachCurrent = getXpRequiredForLevel(level);

    // XP to reach Next Level start
    const xpToReachNext = getXpRequiredForLevel(level + 1);

    const xpInCurrentLevel = totalXp - xpToReachCurrent;
    const requirementsForNext = xpToReachNext - xpToReachCurrent;

    return {
        level,
        remainder: xpInCurrentLevel,
        nextLevelXp: requirementsForNext,
        progress: (requirementsForNext > 0) ? Math.min(100, (xpInCurrentLevel / requirementsForNext) * 100) : 100
    };
}
