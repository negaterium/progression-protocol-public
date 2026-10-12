import { addDays, startOfDay, differenceInMilliseconds } from 'date-fns';

export const BOSS_COOLDOWNS: Record<string, number> = {
    'E': 1,
    'C': 2,
    'D': 3,
    'B': 4,
    'A': 5,
    'S': 7,
    'S+': 14,
    'XX': 30,
    'COSMIC': 60,  // Cosmic bosses reset every 2 months — these are events
};

export function calculateBossCooldown(lastDefeatedAt: string | Date | undefined, rank: string) {
    if (!lastDefeatedAt) {
        return { isReady: true, timeLeftMs: 0, h: 0, m: 0, d: 0 };
    }

    const rankKey = rank === 'COSMIC' ? 'COSMIC' : (rank === 'S+' || rank === 'XX' ? rank : (rank.includes('S') ? 'S' : rank.charAt(0)));
    // Default to 1 day if rank not found
    const cooldownDays = BOSS_COOLDOWNS[rankKey] || 1;

    const lastRun = new Date(lastDefeatedAt);
    const now = new Date();

    // Logic: Reset happens at 00:00 (Midnight) after X days
    // If defeated today at 15:00, and cooldown is 1 day.
    // Reset should be Tomorrow at 00:00.
    // implementation: startOfDay(lastRun) + (cooldownDays days). 
    // Example: 
    // Defeated: 2024-01-01 15:00. Cooldown: 1 Day.
    // StartOfDay: 2024-01-01 00:00.
    // Add 1 Day: 2024-01-02 00:00.
    // Result: Resets at midnight the next day.

    const resetDate = addDays(startOfDay(lastRun), cooldownDays);
    const diff = differenceInMilliseconds(resetDate, now);

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
