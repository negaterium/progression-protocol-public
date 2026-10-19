import { CURRENT_BOSS_COOLDOWNS, normalizeBossRank } from './boss-balance-policy';

export const BOSS_COOLDOWNS = CURRENT_BOSS_COOLDOWNS;

export function calculateBossCooldown(lastDefeatedAt: string | Date | undefined, rank: string, now = new Date()) {
    if (!lastDefeatedAt) {
        return { isReady: true, timeLeftMs: 0, h: 0, m: 0, d: 0 };
    }

    const rankKey = normalizeBossRank(rank);
    // Default to 1 day if rank not found
    const cooldownDays = BOSS_COOLDOWNS[rankKey] || 1;

    const lastRun = new Date(lastDefeatedAt);

    // Logic: Reset happens at 00:00 (Midnight) after X days
    // If defeated today at 15:00, and cooldown is 1 day.
    // Reset should be Tomorrow at 00:00.
    // implementation: startOfDay(lastRun) + (cooldownDays days). 
    // Example: 
    // Defeated: 2024-01-01 15:00. Cooldown: 1 Day.
    // StartOfDay: 2024-01-01 00:00.
    // Add 1 Day: 2024-01-02 00:00.
    // Result: Resets at midnight the next day.

    // Keep the historical encounter-start origin; use UTC midnight in every runtime.
    const resetDate = new Date(Date.UTC(lastRun.getUTCFullYear(), lastRun.getUTCMonth(), lastRun.getUTCDate() + cooldownDays));
    const diff = resetDate.getTime() - now.getTime();
    if (!Number.isFinite(diff)) throw new Error('Invalid boss cooldown timestamp');

    if (diff <= 0) {
        return { isReady: true, timeLeftMs: 0, h: 0, m: 0, d: 0 };
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return {
        isReady: false,
        timeLeftMs: diff,
        d,
        h,
        m
    };
}
