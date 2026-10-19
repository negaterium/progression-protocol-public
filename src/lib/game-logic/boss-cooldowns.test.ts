import { describe, expect, it } from 'vitest';
import { calculateBossCooldown } from './boss-cooldowns';

describe('Boss cooldowns use UTC calendar days from encounter start', () => {
    it('permits a never-defeated boss', () => expect(calculateBossCooldown(undefined, 'E').isReady).toBe(true));
    it.each([['E', 1], ['C', 2], ['D', 3], ['B', 4], ['A', 5], ['S', 3], ['S+', 7], ['XX', 14], ['COSMIC', 60]] as const)(
        '%s resets after %i UTC calendar days', (rank, days) => {
            const start = '2026-10-01T23:45:00Z';
            const reset = new Date(Date.UTC(2026, 9, 1 + days));
            expect(calculateBossCooldown(start, rank, new Date(reset.getTime() - 1)).isReady).toBe(false);
            expect(calculateBossCooldown(start, rank, reset).isReady).toBe(true);
        });
    it('normalizes decorated S+ ranks without silently downgrading them to S', () => {
        const now = new Date('2026-10-05T00:00:00Z');
        expect(calculateBossCooldown('2026-10-01T21:00:00Z', 'S+-RANK', now)).toEqual(calculateBossCooldown('2026-10-01T21:00:00Z', 'S+', now));
        expect(calculateBossCooldown('2026-10-01T21:00:00Z', 'S+-RANK', now).d).toBe(3);
    });
    it('does not depend on browser offset or daylight saving transitions', () => {
        const now = new Date('2026-10-26T00:00:00Z');
        expect(calculateBossCooldown('2026-10-24T23:30:00-04:00', 'S', now).d).toBe(2);
        expect(calculateBossCooldown('2026-10-25T03:30:00Z', 'S', now).d).toBe(2);
    });
    it('rejects invalid timestamps instead of leaving a gate permanently locked', () => {
        expect(() => calculateBossCooldown('invalid', 'S')).toThrow('Invalid boss cooldown timestamp');
    });
});
