import { expect, test, describe } from 'vitest'
import { calculateBossCooldown } from './boss-cooldowns'

describe('Boss Cooldown Logic', () => {
    test('Boss is ready if never defeated', () => {
        const result = calculateBossCooldown(undefined, 'E');
        expect(result.isReady).toBe(true);
    });

    test('E-Rank boss on cooldown (defeated today at noon)', () => {
        const now = new Date();
        const lastDefeat = new Date(now);
        lastDefeat.setHours(12, 0, 0, 0); // Defeated at 12:00 today

        // If we are testing this technically "now" could be anytime. 
        // Let's mock "now" to be 14:00 today.
        // So defeat was 2 hours ago. 
        // Reset should be tomorrow 00:00.
        // Diff = (Tomorrow 00:00) - (Today 14:00) = 10 hours.

        // However, calculateBossCooldown uses new Date() internally for "now".
        // To properly test time-sensitive logic without mocking Date, we can check relative bounds.

        const result = calculateBossCooldown(lastDefeat, 'E');

        // If it's currently BEFORE midnight of the next day, it should not be ready.
        // Unless we are running this test at exactly 00:00:00...

        // Check if lastDefeat (today 12:00) + 1 day (tomorrow 00:00) > now
        // If now is > tomorrow 00:00, it would be ready.
        // But since lastDefeat is *today* 12:00, "tomorrow 00:00" is definitely in the future relative to "now".
        // (Unless "now" is already tomorrow? No, we constructed lastDefeat based on now).
        // Wait, if I run this at 23:59, lastDefeat is today 12:00. Reset is tomorrow 00:00. Diff is 1 min.

        // To make this robust, let's just ensure if we defeated it "recently" (today), it's not ready.
        // Caveat: If we run this test, create a date "12:00", but "now" is actually "tomorrow 01:00"??
        // No, `const now = new Date()` is the anchor.

        // Let's use a fixed date for the test to be deterministic.
        // We can't easily mock "now" inside the function without dependency injection or system clock mocking.
        // But we can check that `isReady` is false if we just beat it.

        expect(result.isReady).toBe(false);
    });

    test('E-Rank boss resets at midnight (Manual Date Check equivalent)', () => {
        // Since we can't mock "now" inside the function easily, we trust the logic:
        // resetDate = startOfDay(lastDefeat) + cooldownDays

        // Let's verify the behavior by passing a date from Yesterday 15:00.
        // yesterday 15:00. Cooldown 1 day -> Reset at Today 00:00.
        // So if we run this test Today at 00:01+, it should be READY.

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(15, 0, 0, 0);

        const result = calculateBossCooldown(yesterday, 'E');
        expect(result.isReady).toBe(true);
    });

    test('S-Rank boss (7 days) not ready after 6 days', () => {
        // Last defeat: 6 days ago (at 12:00)
        const lastDefeat = new Date();
        lastDefeat.setDate(lastDefeat.getDate() - 6);
        lastDefeat.setHours(12, 0, 0, 0);

        // Reset time: startOfDay(6 days ago) + 7 days = Tomorrow 00:00.
        // So it should NOT be ready yet.

        const result = calculateBossCooldown(lastDefeat, 'S');
        expect(result.isReady).toBe(false);
    });

    test('S-Rank boss ready after 8 days', () => {
        const lastDefeat = new Date();
        lastDefeat.setDate(lastDefeat.getDate() - 8);

        const result = calculateBossCooldown(lastDefeat, 'S');
        expect(result.isReady).toBe(true);
    });

    test('XX-Rank boss on cooldown (defeated 15 days ago)', () => {
        const lastDefeat = new Date();
        lastDefeat.setDate(lastDefeat.getDate() - 15);

        const result = calculateBossCooldown(lastDefeat, 'XX');
        expect(result.isReady).toBe(false);
        expect(result.d).toBeGreaterThanOrEqual(14);
    });
});
