import { describe, it, expect } from 'vitest';
import { BOSS_RANK_KEY_SUFFIX, getBossKeyDropChance, getBossKeySuffix, BOSS_KEY_DROP_CHANCE } from '@/lib/system/rank-constants';

describe('Boss Key Drop & Rank Constants', () => {
    it('maps all boss ranks correctly to key name suffixes', () => {
        expect(BOSS_RANK_KEY_SUFFIX['E']).toBe('E-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['D']).toBe('D-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['C']).toBe('C-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['B']).toBe('B-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['A']).toBe('A-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['S']).toBe('S-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['S+']).toBe('S+-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['XX']).toBe('XX-Rank');
        expect(BOSS_RANK_KEY_SUFFIX['COSMIC']).toBe('Cosmic');
    });

    it('verifies getBossKeySuffix correctly resolves same-level suffixes for standard and variant ranks', () => {
        expect(getBossKeySuffix('E')).toBe('E-Rank');
        expect(getBossKeySuffix('D')).toBe('D-Rank');
        expect(getBossKeySuffix('C')).toBe('C-Rank');
        expect(getBossKeySuffix('B')).toBe('B-Rank');
        expect(getBossKeySuffix('A')).toBe('A-Rank');
        expect(getBossKeySuffix('S')).toBe('S-Rank');
        expect(getBossKeySuffix('S+')).toBe('S+-Rank');
        expect(getBossKeySuffix('S+-Rank')).toBe('S+-Rank');
        expect(getBossKeySuffix('XX')).toBe('XX-Rank');
        expect(getBossKeySuffix('XX-Rank')).toBe('XX-Rank');
        expect(getBossKeySuffix('COSMIC')).toBe('Cosmic');
        expect(getBossKeySuffix(null)).toBe('E-Rank');
        expect(getBossKeySuffix(undefined)).toBe('E-Rank');
    });

    it('confirms getBossKeyDropChance provides guaranteed 100% drops for S and above, and >=70% for lower ranks', () => {
        // Guaranteed 100% for endgame ranks
        expect(getBossKeyDropChance('S')).toBe(1.0);
        expect(getBossKeyDropChance('S+')).toBe(1.0);
        expect(getBossKeyDropChance('XX')).toBe(1.0);
        expect(getBossKeyDropChance('COSMIC')).toBe(1.0);
        expect(getBossKeyDropChance('S-Rank')).toBe(1.0);
        expect(getBossKeyDropChance('S+-Rank')).toBe(1.0);
        expect(getBossKeyDropChance('XX-Rank')).toBe(1.0);

        // Lower ranks >= 70%
        expect(getBossKeyDropChance('E')).toBe(0.70);
        expect(getBossKeyDropChance('D')).toBe(0.70);
        expect(getBossKeyDropChance('C')).toBe(0.70);
        expect(getBossKeyDropChance('B')).toBe(0.80);
        expect(getBossKeyDropChance('A')).toBe(0.80);
        expect(getBossKeyDropChance(null)).toBe(0.70);
        expect(getBossKeyDropChance(undefined)).toBe(0.70);
    });

    it('simulates 1,000 S+-Rank boss kills and confirms 100% guaranteed same-level (S+-Rank) key drops', () => {
        let keyDropCount = 0;
        let sPlusKeyCount = 0;
        const bossRank = 'S+';
        const dropChance = getBossKeyDropChance(bossRank);

        for (let i = 0; i < 1000; i++) {
            if (Math.random() <= dropChance) {
                keyDropCount++;
                const keySuffix = getBossKeySuffix(bossRank);
                if (keySuffix === 'S+-Rank') {
                    sPlusKeyCount++;
                }
            }
        }

        // 100% guaranteed drops: every kill must yield an S+-Rank key
        expect(keyDropCount).toBe(1000);
        expect(sPlusKeyCount).toBe(1000);
    });

    it('simulates 1,000 B-Rank boss kills and confirms key drop rate is ~80% same-level (B-Rank)', () => {
        let keyDropCount = 0;
        let bKeyCount = 0;
        const bossRank = 'B';
        const dropChance = getBossKeyDropChance(bossRank);

        for (let i = 0; i < 1000; i++) {
            if (Math.random() <= dropChance) {
                keyDropCount++;
                const keySuffix = getBossKeySuffix(bossRank);
                if (keySuffix === 'B-Rank') {
                    bKeyCount++;
                }
            }
        }

        // Standard deviation check: 800 expected out of 1000, tolerance ± 50
        expect(keyDropCount).toBeGreaterThanOrEqual(750);
        expect(keyDropCount).toBeLessThanOrEqual(850);
        expect(bKeyCount).toBe(keyDropCount); // All dropped keys match the boss's rank tier
    });
});

