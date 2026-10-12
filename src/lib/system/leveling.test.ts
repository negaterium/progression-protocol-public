import { expect, test, describe } from 'vitest';
import { getXpRequiredForLevel, calculateLevel } from './leveling';

describe('Leveling System Curve', () => {
    test('Level 1 requires 0 XP', () => {
        expect(getXpRequiredForLevel(1)).toBe(0);
        expect(calculateLevel(0).level).toBe(1);
    });

    test('Level 15 matches ~85,400 XP baseline', () => {
        expect(getXpRequiredForLevel(15)).toBe(85400);
        expect(calculateLevel(85400).level).toBe(15);
    });

    test('Level 100 matches baseline ~940,500 XP', () => {
        expect(getXpRequiredForLevel(100)).toBe(940500);
        expect(calculateLevel(940500).level).toBe(100);
    });

    test('Level 101 requires High-Tier Monarch Step (~124,700 XP for L100 -> L101)', () => {
        const xpL100 = getXpRequiredForLevel(100);
        const xpL101 = getXpRequiredForLevel(101);
        const delta = xpL101 - xpL100;
        expect(delta).toBeGreaterThanOrEqual(124000);
        expect(calculateLevel(xpL101).level).toBe(101);
    });

    test('XP of 8,318,484 maps to Level 146 in tuned curve', () => {
        const lvlData = calculateLevel(8318484);
        expect(lvlData.level).toBe(146);
    });

    test('XP of 9,810,976 maps to Level 154 (~49.5% progress)', () => {
        const lvlData = calculateLevel(9810976);
        expect(lvlData.level).toBe(154);
        expect(lvlData.progress).toBeCloseTo(49.5, 0);
    });

    test('Level 998 to 999 takes ~130k XP (~3 days at endgame rewards)', () => {
        const xpL998 = getXpRequiredForLevel(998);
        const xpL999 = getXpRequiredForLevel(999);
        const delta = xpL999 - xpL998;
        expect(delta).toBeLessThanOrEqual(140000);
        expect(delta).toBeGreaterThanOrEqual(120000);
    });

    test('Level 999 cumulative XP is ~114M XP (10-year lifespan max target)', () => {
        const xpL999 = getXpRequiredForLevel(999);
        expect(xpL999).toBeGreaterThan(110_000_000);
        expect(xpL999).toBeLessThan(120_000_000);
    });
});
